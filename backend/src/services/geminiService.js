/**
 * geminiService.js — SENTINAL Gemini 2.0 Flash integration
 *
 * Provides two grounded AI capabilities:
 *   1. chat()           — security analyst Q&A grounded in real AttackEvent data
 *   2. generateReport() — structured incident report for a single attack
 *
 * Both methods degrade gracefully: if GEMINI_API_KEY is absent or the API
 * call fails, a structured static fallback is returned so the UI never breaks.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');

// ── Model init (lazy — only called if key present) ───────────────────────────
let _genAI = null;
let _model = null;

function getModel() {
  if (_model) return _model;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  _genAI = new GoogleGenerativeAI(key);
  _model = _genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return _model;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stripFences(text) {
  return text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}

function safeParseJSON(text) {
  try { return JSON.parse(stripFences(text)); } catch { return null; }
}

/**
 * Build a compact attack context string from an array of AttackEvent docs.
 * Keeps token count low while giving Gemini enough signal for grounded answers.
 */
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
/**
 * @param {string}   question     - Analyst's natural-language question
 * @param {object[]} recentAttacks - Array of AttackEvent Mongoose docs
 * @returns {Promise<{answer: string, grounded: boolean}>}
 */
async function chat(question, recentAttacks) {
  const model = getModel();

  if (!model) {
    logger.warn('[GeminiService] GEMINI_API_KEY not set — returning static fallback for chat');
    return {
      answer: 'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file to enable the Security Co-Pilot.',
      grounded: false,
    };
  }

  const context = buildAttackContext(recentAttacks);

  const prompt = `You are SENTINEL AI, a senior cybersecurity analyst assistant embedded in the SENTINAL threat detection platform.

You have access to the following REAL, LIVE attack telemetry from the last 24 hours:

${context}

Based on this live data, answer the analyst's question below. Be direct, specific, and actionable.
If the data doesn't contain enough information to fully answer, say so and give your best analysis.
Do NOT make up attack events that aren't in the data above.
Keep your answer under 300 words. Format clearly using plain text — no markdown headers.

Analyst Question: ${question}`;

  try {
    const result = await model.generateContent(prompt);
    const answer = result.response.text().trim();
    logger.info('[GeminiService] chat() — Gemini response received');
    return { answer, grounded: true };
  } catch (err) {
    logger.error(`[GeminiService] chat() failed: ${err.message}`);
    return {
      answer: `Analysis unavailable: ${err.message}. Please check your Gemini API key and quota.`,
      grounded: false,
    };
  }
}

// ── 2. Incident Report Generator ─────────────────────────────────────────────
/**
 * @param {object} attack - Single AttackEvent Mongoose doc (populated)
 * @returns {Promise<object>} Structured incident report object
 */
async function generateReport(attack) {
  const model = getModel();

  // Static fallback structure
  const staticReport = {
    generated: false,
    executive_summary: `${attack.attackType?.toUpperCase() || 'UNKNOWN'} attack detected from ${attack.ip || 'unknown IP'} with ${attack.severity} severity.`,
    technical_finding: attack.payload ? `Malicious payload identified: ${String(attack.payload).slice(0, 200)}` : 'No payload data captured.',
    likely_impact: attack.severity === 'critical' ? 'Potential data breach or service disruption if not addressed immediately.' : 'Limited impact if promptly mitigated.',
    remediation_steps: [
      `Block source IP: ${attack.ip || 'unknown'}`,
      `Review all requests from this IP in the last 24 hours`,
      `Update WAF rules to filter ${attack.attackType || 'this'} attack patterns`,
      'Apply latest security patches to affected services',
    ],
    next_steps: 'Escalate to security team if severity is critical or high. Monitor for repeat attempts from the same IP range.',
    risk_level: attack.severity || 'unknown',
    generated_at: new Date().toISOString(),
  };

  if (!model) {
    logger.warn('[GeminiService] GEMINI_API_KEY not set — returning static report');
    return staticReport;
  }

  const prompt = `You are SENTINEL AI generating a formal cybersecurity incident report.

ATTACK EVENT DATA:
- Attack ID:    ${attack._id}
- Attack Type:  ${attack.attackType}
- Severity:     ${attack.severity}
- Status:       ${attack.status}
- Source IP:    ${attack.ip || 'unknown'}
- Detected By:  ${attack.detectedBy || 'unknown'}
- Confidence:   ${attack.confidence != null ? Math.round(attack.confidence * 100) + '%' : 'unknown'}
- Timestamp:    ${attack.timestamp ? new Date(attack.timestamp).toISOString() : 'unknown'}
- Payload:      ${String(attack.payload || 'none').slice(0, 200)}
- Explanation:  ${typeof attack.explanation === 'string' ? attack.explanation.slice(0, 300) : JSON.stringify(attack.explanation || {}).slice(0, 300)}

Generate a structured incident report as a JSON object with EXACTLY these fields:
{
  "executive_summary": "2-3 sentence non-technical summary for management",
  "technical_finding": "detailed technical description of the attack vector and method",
  "likely_impact": "what damage this attack could cause if successful",
  "remediation_steps": ["step 1", "step 2", "step 3", "step 4"],
  "next_steps": "immediate actions the security team should take",
  "risk_level": "${attack.severity}"
}

Return ONLY valid JSON. No markdown. No extra text.`;

  try {
    const result = await model.generateContent(prompt);
    const text   = result.response.text().trim();
    const parsed = safeParseJSON(text);

    if (!parsed) {
      logger.warn('[GeminiService] generateReport() — JSON parse failed, returning static report');
      return staticReport;
    }

    logger.info(`[GeminiService] generateReport() — report generated for attack ${attack._id}`);
    return {
      ...parsed,
      generated: true,
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`[GeminiService] generateReport() failed: ${err.message}`);
    return staticReport;
  }
}

module.exports = { chat, generateReport };
