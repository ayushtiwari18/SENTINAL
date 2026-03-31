/**
 * geminiService.js — SENTINAL Gemini AI integration
 *
 * Verified free-tier model chain (March 2026):
 *   1. gemini-2.5-flash-lite  — 15 RPM, 1000 RPD — lightest quota, try first
 *   2. gemini-2.5-flash        — 10 RPM,  250 RPD — fallback if lite exhausted
 *
 * Both models are confirmed active on v1beta generateContent as of 2026.
 * Deprecated/removed models that must NOT be used:
 *   ✗ gemini-1.5-flash        (404 on v1beta)
 *   ✗ gemini-1.5-flash-8b     (404 on v1beta)
 *   ✗ gemini-2.0-flash-lite   (404 on v1beta)
 *   ✗ gemini-2.0-flash        (quota limit=0 on free tier)
 *
 * Features:
 *   - Single retry per model on 429 (waits retryDelay from API response or 20s)
 *   - Falls to next model in chain on 429, throws QUOTA_EXHAUSTED when all fail
 *   - 404 on a model surfaces immediately as UNKNOWN_ERROR (not swallowed)
 *   - Clean user-facing messages — no raw API error blobs in the UI
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// ── Verified model chain (do not change without testing on v1beta) ───────────
const MODEL_CHAIN = [
  'gemini-2.5-flash-lite', // 15 RPM, 1000 RPD — highest free-tier allowance
  'gemini-2.5-flash',      // 10 RPM,  250 RPD — fallback
];

let _genAI  = null;
let _models = null;

function getModels() {
  if (_models) return _models;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI  = new GoogleGenerativeAI(key);
  _models = MODEL_CHAIN.map(name => _genAI.getGenerativeModel({ model: name }));
  return _models;
}

// Reset cached model instances (e.g. if key changes at runtime)
function resetModels() {
  _genAI  = null;
  _models = null;
}

// ── Extract retry-after delay from 429 error message ────────────────────────
function getRetryDelay(errMessage, defaultMs = 20_000) {
  // API embeds "retryDelay":"29s" or "Please retry in 29.3s" in the message
  const match = errMessage && errMessage.match(/retry(?:Delay)?[":\s]+([0-9.]+)s/i);
  if (match) {
    const seconds = parseFloat(match[1]);
    if (!isNaN(seconds) && seconds > 0) return Math.ceil(seconds) * 1000;
  }
  return defaultMs;
}

// ── Core: generate with model fallback + one retry per model on 429 ─────────
async function generateWithFallback(prompt) {
  const models = getModels();
  if (!models) return null; // caller handles null as NO_API_KEY

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await models[m].generateContent(prompt);
        logger.info(`[GeminiService] ✓ ${modelName} responded (attempt ${attempt})`);
        return result.response.text().trim();
      } catch (err) {
        const msg   = err.message || '';
        const is429 = msg.includes('429');
        const is404 = msg.includes('404');

        if (is404) {
          // Model doesn't exist on v1beta — no point retrying or falling back
          logger.error(`[GeminiService] 404: model ${modelName} not found on v1beta. Check MODEL_CHAIN.`);
          throw err; // surfaces as UNKNOWN_ERROR — operator must fix config
        }

        if (is429 && attempt === 1) {
          const delay = getRetryDelay(msg);
          logger.warn(`[GeminiService] ${modelName} rate-limited, retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (is429 && attempt === 2) {
          logger.warn(`[GeminiService] ${modelName} still rate-limited after retry — moving to next model`);
          break; // try next model
        }

        // Any other error (auth, network, etc.) — surface immediately
        throw err;
      }
    }
  }

  // All models in chain exhausted
  const quotaErr = new Error('QUOTA_EXHAUSTED');
  quotaErr.isQuotaError = true;
  throw quotaErr;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}

function safeParseJSON(text) {
  try { return JSON.parse(stripFences(text)); } catch { return null; }
}

function buildAttackContext(attacks) {
  if (!attacks || !attacks.length) return 'No recent attack data available.';
  return attacks
    .slice(0, 40)
    .map((a, i) =>
      `[${i + 1}] type=${a.attackType} severity=${a.severity} status=${a.status} ` +
      `ip=${a.ip || 'unknown'} detectedBy=${a.detectedBy || 'unknown'} ` +
      `confidence=${a.confidence != null ? Math.round(a.confidence * 100) + '%' : '?'} ` +
      `payload=${String(a.payload || '').slice(0, 80)} ` +
      `ts=${a.timestamp ? new Date(a.timestamp).toISOString() : 'unknown'}`
    )
    .join('\n');
}

// ── 1. Security Co-Pilot Chat ─────────────────────────────────────────────────
async function chat(question, recentAttacks) {
  if (!getModels()) {
    logger.warn('[GeminiService] GEMINI_API_KEY not set');
    return {
      answer: 'Gemini API key is not configured. Add GEMINI_API_KEY to your .env file to enable the Security Co-Pilot.',
      grounded: false,
      errorCode: 'NO_API_KEY',
    };
  }

  const context = buildAttackContext(recentAttacks);
  const prompt =
    `You are SENTINEL AI, a senior cybersecurity analyst embedded in the SENTINAL threat detection platform.\n\n` +
    `You have access to the following REAL, LIVE attack telemetry from the last 24 hours:\n\n${context}\n\n` +
    `Answer the analyst's question below. Be direct, specific, and actionable.\n` +
    `Do NOT fabricate attack events not present in the data above.\n` +
    `Keep your answer under 300 words. Use plain text — no markdown headers.\n\n` +
    `Analyst Question: ${question}`;

  try {
    const answer = await generateWithFallback(prompt);
    if (answer === null) {
      return { answer: 'Gemini API key is not configured.', grounded: false, errorCode: 'NO_API_KEY' };
    }
    return { answer, grounded: true };
  } catch (err) {
    if (err.isQuotaError) {
      logger.warn('[GeminiService] quota exhausted across all models for chat()');
      return {
        answer:
          'The AI Co-Pilot has reached its free-tier API quota for today (Google AI Studio). ' +
          'Quota resets daily at midnight Pacific time. ' +
          'To remove this limit, enable billing at https://ai.google.dev.',
        grounded: false,
        errorCode: 'QUOTA_EXHAUSTED',
      };
    }
    logger.error(`[GeminiService] chat() failed: ${err.message}`);
    return {
      answer: 'An unexpected error occurred while contacting the AI service. Please try again in a moment.',
      grounded: false,
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

// ── 2. Incident Report Generator ─────────────────────────────────────────────
async function generateReport(attack) {
  const staticReport = {
    generated: false,
    executive_summary: `${attack.attackType?.toUpperCase() || 'UNKNOWN'} attack detected from ${attack.ip || 'unknown IP'} with ${attack.severity} severity.`,
    technical_finding: attack.payload
      ? `Malicious payload identified: ${String(attack.payload).slice(0, 200)}`
      : 'No payload data captured.',
    likely_impact:
      attack.severity === 'critical'
        ? 'Potential data breach or service disruption if not addressed immediately.'
        : 'Limited impact if promptly mitigated.',
    remediation_steps: [
      `Block source IP: ${attack.ip || 'unknown'}`,
      'Review all requests from this IP in the last 24 hours',
      `Update WAF rules to filter ${attack.attackType || 'this'} attack patterns`,
      'Apply latest security patches to affected services',
    ],
    next_steps: 'Escalate to security team if severity is critical or high. Monitor for repeat attempts.',
    risk_level: attack.severity || 'unknown',
    generated_at: new Date().toISOString(),
  };

  if (!getModels()) {
    logger.warn('[GeminiService] GEMINI_API_KEY not set — returning static report');
    return staticReport;
  }

  const prompt =
    `You are SENTINEL AI generating a formal cybersecurity incident report.\n\n` +
    `ATTACK EVENT DATA:\n` +
    `- Attack ID:    ${attack._id}\n` +
    `- Attack Type:  ${attack.attackType}\n` +
    `- Severity:     ${attack.severity}\n` +
    `- Status:       ${attack.status}\n` +
    `- Source IP:    ${attack.ip || 'unknown'}\n` +
    `- Detected By:  ${attack.detectedBy || 'unknown'}\n` +
    `- Confidence:   ${attack.confidence != null ? Math.round(attack.confidence * 100) + '%' : 'unknown'}\n` +
    `- Timestamp:    ${attack.timestamp ? new Date(attack.timestamp).toISOString() : 'unknown'}\n` +
    `- Payload:      ${String(attack.payload || 'none').slice(0, 200)}\n` +
    `- Explanation:  ${typeof attack.explanation === 'string' ? attack.explanation.slice(0, 300) : JSON.stringify(attack.explanation || {}).slice(0, 300)}\n\n` +
    `Generate a structured incident report as a JSON object with EXACTLY these fields:\n` +
    `{\n` +
    `  "executive_summary": "2-3 sentence non-technical summary for management",\n` +
    `  "technical_finding": "detailed technical description of the attack vector",\n` +
    `  "likely_impact": "what damage this attack could cause if successful",\n` +
    `  "remediation_steps": ["step 1", "step 2", "step 3", "step 4"],\n` +
    `  "next_steps": "immediate actions for the security team",\n` +
    `  "risk_level": "${attack.severity}"\n` +
    `}\n\nReturn ONLY valid JSON. No markdown. No extra text.`;

  try {
    const text = await generateWithFallback(prompt);
    if (text === null) return staticReport;
    const parsed = safeParseJSON(text);
    if (!parsed) {
      logger.warn('[GeminiService] generateReport() — JSON parse failed, using static report');
      return staticReport;
    }
    logger.info(`[GeminiService] generateReport() — done for ${attack._id}`);
    return { ...parsed, generated: true, generated_at: new Date().toISOString() };
  } catch (err) {
    if (err.isQuotaError) {
      logger.warn('[GeminiService] quota exhausted for generateReport() — returning static report');
      return staticReport;
    }
    logger.error(`[GeminiService] generateReport() failed: ${err.message}`);
    return staticReport;
  }
}

module.exports = { chat, generateReport, resetModels };
