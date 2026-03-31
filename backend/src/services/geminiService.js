/**
 * geminiService.js — SENTINAL Gemini AI integration
 *
 * Model fallback chain (free-tier friendly):
 *   1. gemini-2.0-flash-lite  — lightest quota bucket, tried first
 *   2. gemini-1.5-flash-8b    — fallback if lite is also rate-limited
 *
 * Features:
 *   - Exponential backoff retry on 429 (up to 3 attempts)
 *   - Clean user-facing error messages (no raw API blobs)
 *   - Graceful static fallback if all models fail or key is missing
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// ── Model fallback chain ──────────────────────────────────────────────────────
const MODEL_CHAIN = [
  'gemini-2.0-flash-lite',  // lightest free-tier quota — try first
  'gemini-1.5-flash-8b',    // older 8B model — separate quota bucket
];

let _genAI  = null;
let _models = null; // array of model instances, one per MODEL_CHAIN entry

function getModels() {
  if (_models) return _models;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI  = new GoogleGenerativeAI(key);
  _models = MODEL_CHAIN.map(name => _genAI.getGenerativeModel({ model: name }));
  return _models;
}

// ── Retry helper ──────────────────────────────────────────────────────────────
/**
 * Calls fn() with exponential backoff on 429 errors.
 * Tries MODEL_CHAIN[0] → MODEL_CHAIN[1] → throws with clean message.
 */
async function generateWithFallback(prompt) {
  const models = getModels();
  if (!models) return null; // no API key

  for (let m = 0; m < models.length; m++) {
    const modelName = MODEL_CHAIN[m];
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await models[m].generateContent(prompt);
        logger.info(`[GeminiService] response from ${modelName} (attempt ${attempt})`);
        return result.response.text().trim();
      } catch (err) {
        const is429 = err.message && err.message.includes('429');

        if (is429 && attempt < MAX_RETRIES) {
          const delay = attempt * 15_000; // 15s, 30s
          logger.warn(`[GeminiService] ${modelName} rate-limited (attempt ${attempt}), retrying in ${delay / 1000}s...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        if (is429) {
          logger.warn(`[GeminiService] ${modelName} quota exhausted — trying next model in chain`);
          break; // move to next model
        }

        // Non-429 error — surface it immediately
        throw err;
      }
    }
  }

  // All models exhausted
  const err = new Error('QUOTA_EXHAUSTED');
  err.isQuotaError = true;
  throw err;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
      answer: 'Gemini API key is not configured. Add GEMINI_API_KEY to your .env file.',
      grounded: false,
      errorCode: 'NO_API_KEY',
    };
  }

  const context = buildAttackContext(recentAttacks);

  const prompt =
    `You are SENTINEL AI, a senior cybersecurity analyst embedded in the SENTINAL threat detection platform.\n\n` +
    `You have access to the following REAL, LIVE attack telemetry from the last 24 hours:\n\n${context}\n\n` +
    `Answer the analyst's question below. Be direct, specific, and actionable.\n` +
    `If the data is insufficient, say so and give your best analysis.\n` +
    `Do NOT fabricate attack events not present in the data above.\n` +
    `Keep your answer under 300 words. Use plain text — no markdown headers.\n\n` +
    `Analyst Question: ${question}`;

  try {
    const answer = await generateWithFallback(prompt);
    return { answer, grounded: true };
  } catch (err) {
    if (err.isQuotaError) {
      logger.warn('[GeminiService] all models quota-exhausted for chat()');
      return {
        answer:
          'The AI Co-Pilot has reached its API quota for today. ' +
          'This is a free-tier limit on Google AI Studio. ' +
          'You can either wait until the quota resets (usually midnight Pacific time) ' +
          'or upgrade to a paid Gemini API plan at https://ai.google.dev.',
        grounded: false,
        errorCode: 'QUOTA_EXHAUSTED',
      };
    }
    logger.error(`[GeminiService] chat() failed: ${err.message}`);
    return {
      answer: 'An unexpected error occurred while contacting the AI service. Please try again.',
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
    next_steps:
      'Escalate to security team if severity is critical or high. Monitor for repeat attempts.',
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
    const text   = await generateWithFallback(prompt);
    const parsed = safeParseJSON(text);
    if (!parsed) {
      logger.warn('[GeminiService] generateReport() — JSON parse failed, returning static report');
      return staticReport;
    }
    logger.info(`[GeminiService] generateReport() — report generated for ${attack._id}`);
    return { ...parsed, generated: true, generated_at: new Date().toISOString() };
  } catch (err) {
    if (err.isQuotaError) {
      logger.warn('[GeminiService] all models quota-exhausted for generateReport()');
      return staticReport;
    }
    logger.error(`[GeminiService] generateReport() failed: ${err.message}`);
    return staticReport;
  }
}

module.exports = { chat, generateReport };
