/**
 * geminiService.js — SENTINAL × Gemini Flash Integration
 *
 * Two exported functions:
 *   chatWithCopilot(history, userMessage)  — Security Co-Pilot chat
 *   generateIncidentReport(attackId)       — Structured incident report for a single attack
 *
 * Environment:
 *   GEMINI_API_KEY  — required (Google AI Studio key)
 *
 * Design decisions:
 *   - Uses @google/generative-ai SDK (already indirectly pulled via ArmorIQ gemini_explainer)
 *   - Falls back gracefully if GEMINI_API_KEY is missing (returns error object)
 *   - All Mongo queries are read-only — zero side effects
 *   - Max 20 messages kept in history to avoid token overflows
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const AttackEvent = require('../models/AttackEvent');
const SystemLog   = require('../models/SystemLog');
const logger      = require('../utils/logger');

const MODEL_NAME = 'gemini-1.5-flash';
const MAX_HISTORY = 20;

// ── Lazy-init Gemini client so missing key doesn't crash startup ─────────────
let _genAI = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _genAI;
}

// ── System prompt for Security Co-Pilot ─────────────────────────────────────
const COPILOT_SYSTEM_PROMPT = `You are SENTINAL Co-Pilot, an expert cybersecurity assistant embedded inside the SENTINAL security monitoring platform.

Your responsibilities:
- Explain attack types (SQLi, XSS, LFI, SSRF, Command Injection, etc.) clearly
- Help analysts understand attack payloads and what they attempt to do
- Suggest remediation steps and defensive countermeasures
- Interpret CVSS scores, confidence levels, and severity ratings
- Answer questions about the SENTINAL platform itself
- Provide concise, actionable security guidance

Tone: professional, precise, jargon-aware but able to explain simply when asked.
Format: use markdown for structure when helpful. Keep answers focused — no filler.
Scope: security topics only. Politely decline unrelated requests.`;

/**
 * Multi-turn chat with the Security Co-Pilot.
 *
 * @param {Array<{role: 'user'|'model', parts: string}>} history - previous turns
 * @param {string} userMessage - current user message
 * @returns {Promise<{reply: string, role: 'model'}>}
 */
async function chatWithCopilot(history = [], userMessage) {
  try {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: COPILOT_SYSTEM_PROMPT,
    });

    // Trim history to prevent token overflow
    const trimmedHistory = history.slice(-MAX_HISTORY).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.parts }],
    }));

    const chat = model.startChat({ history: trimmedHistory });
    const result = await chat.sendMessage(userMessage);
    const reply = result.response.text();

    logger.info('[GEMINI] Co-Pilot response generated successfully');
    return { role: 'model', parts: reply };
  } catch (err) {
    logger.error(`[GEMINI] chatWithCopilot error: ${err.message}`);
    throw err;
  }
}

/**
 * Generate a structured incident report for a given attack ID.
 * Pulls AttackEvent + associated SystemLog from MongoDB to build full context.
 *
 * @param {string} attackId - MongoDB ObjectId string of the AttackEvent
 * @returns {Promise<{report: string, attackId: string, generatedAt: string}>}
 */
async function generateIncidentReport(attackId) {
  try {
    const genAI = getClient();
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // Fetch attack event
    const attack = await AttackEvent.findById(attackId).lean();
    if (!attack) {
      throw new Error(`AttackEvent not found: ${attackId}`);
    }

    // Fetch the originating log (matched by requestId → SystemLog._id)
    let rawLog = null;
    if (attack.requestId) {
      rawLog = await SystemLog.findById(attack.requestId).lean();
    }

    // Build context block for Gemini
    const context = `
ATTACK EVENT:
  ID:          ${attack._id}
  Type:        ${attack.attackType}
  Severity:    ${attack.severity}
  Status:      ${attack.status}
  Confidence:  ${(attack.confidence * 100).toFixed(1)}%
  Detected By: ${attack.detectedBy}
  Timestamp:   ${attack.createdAt}
  Source IP:   ${attack.ip}
  Payload:     ${attack.payload || 'N/A'}
  Explanation: ${attack.explanation || 'N/A'}

${rawLog ? `RAW REQUEST:
  Method:      ${rawLog.method}
  URL:         ${rawLog.url}
  IP:          ${rawLog.ip}
  Response:    ${rawLog.responseCode || 'N/A'}
  User-Agent:  ${rawLog.headers?.userAgent || 'N/A'}
  Query Params:${JSON.stringify(rawLog.queryParams || {})}
  Body:        ${JSON.stringify(rawLog.body || {})}` : 'RAW REQUEST: Not available'}
`.trim();

    const prompt = `You are a senior cybersecurity analyst. Based on the following SENTINAL attack event data, produce a professional incident report in markdown.

Required sections:
1. **Executive Summary** — 2-3 sentences suitable for non-technical management
2. **Attack Details** — type, technique, payload analysis
3. **Timeline** — what happened and when
4. **Impact Assessment** — what data/systems could be affected
5. **Root Cause** — why this attack reached the system
6. **Immediate Actions Taken** — what SENTINAL detected/blocked
7. **Recommended Remediation** — concrete steps with code examples where relevant
8. **Prevention Measures** — long-term hardening recommendations
9. **MITRE ATT&CK Mapping** — relevant technique IDs if applicable

DATA:
${context}

Produce the report now. Be specific and technical. Reference actual values from the data above.`;

    const result = await model.generateContent(prompt);
    const report = result.response.text();

    logger.info(`[GEMINI] Incident report generated for attack ${attackId}`);
    return {
      report,
      attackId,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error(`[GEMINI] generateIncidentReport error: ${err.message}`);
    throw err;
  }
}

module.exports = { chatWithCopilot, generateIncidentReport };
