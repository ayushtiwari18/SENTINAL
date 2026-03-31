/**
 * gemini.js — Gemini AI routes
 *
 * POST /api/gemini/chat                     — single-shot Q&A (+ history, suggestions, citations)
 * GET  /api/gemini/chat/stream              — SSE streaming version
 * POST /api/gemini/report/:attackId         — incident report JSON
 * GET  /api/gemini/report/:attackId/export  — download as Markdown (?format=markdown)
 * POST /api/gemini/correlate                — campaign correlation (saves snapshot)
 * GET  /api/gemini/correlate/history        — last 20 risk score snapshots
 * POST /api/gemini/mutate                   — payload mutation with scoring
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const AttackEvent = require('../models/AttackEvent');
const CorrelationSnapshot = require('../models/CorrelationSnapshot');
const logger     = require('../utils/logger');

const {
  chat,
  chatStream,
  generateReport,
  correlate,
  mutate,
} = require('../services/geminiService');

const router = express.Router();

const geminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment.',
    code: 'GEMINI_RATE_LIMITED',
  },
});

// ── POST /api/gemini/chat ─────────────────────────────────────────────────────
// Body: { message: string, history?: [{ role: 'user'|'model', text: string }] }
router.post('/chat', geminiLimiter, async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'message is required', code: 'VALIDATION_ERROR' });
  }

  // Validate history — max 10 turns, correct shape
  const safeHistory = Array.isArray(history)
    ? history
        .filter(h => h && typeof h.role === 'string' && typeof h.text === 'string')
        .slice(-10)
    : [];

  try {
    const attacks = await AttackEvent.find().sort({ timestamp: -1 }).limit(50).lean().catch(() => []);
    const result  = await chat(message.trim(), attacks, safeHistory);

    logger.info(`[GeminiRoute] /chat — answered (grounded=${result.grounded}, suggestions=${result.suggestions?.length || 0}, sources=${result.sourcedEventIds?.length || 0})`);

    return res.status(200).json({
      success: true,
      data: {
        answer: result.answer,
        grounded: result.grounded,
        errorCode: result.errorCode || null,
        suggestions: result.suggestions || [],
        sourcedEventIds: result.sourcedEventIds || [],
        context_attacks: attacks.length,
      },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /chat unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'AI service error. Please try again.', code: 'GEMINI_ERROR' });
  }
});

// ── GET /api/gemini/chat/stream ───────────────────────────────────────────────
// Query: ?message=...&history=<JSON encoded array>
// Streams SSE: data: {"type":"chunk","text":"..."}
//              data: {"type":"done","suggestions":[...],"sourcedEventIds":[...]}
//              data: {"type":"error","errorCode":"..."}
router.get('/chat/stream', geminiLimiter, async (req, res) => {
  const { message } = req.query;

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ success: false, message: 'message query param is required', code: 'VALIDATION_ERROR' });
    return;
  }

  let safeHistory = [];
  try {
    if (req.query.history) safeHistory = JSON.parse(req.query.history).slice(-10);
  } catch { /* ignore malformed history */ }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const attacks = await AttackEvent.find().sort({ timestamp: -1 }).limit(50).lean().catch(() => []);

    for await (const event of chatStream(message.trim(), attacks, safeHistory)) {
      send(event);
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (err) {
    logger.error(`[GeminiRoute] /chat/stream unhandled error: ${err.message}`);
    send({ type: 'error', errorCode: 'GEMINI_ERROR' });
  } finally {
    res.end();
  }
});

// ── POST /api/gemini/report/:attackId ─────────────────────────────────────────
// Body: { reportType?: 'technical'|'executive'|'forensic' }
router.post('/report/:attackId', geminiLimiter, async (req, res) => {
  const { attackId } = req.params;
  const reportType = ['technical', 'executive', 'forensic'].includes(req.body?.reportType)
    ? req.body.reportType
    : 'technical';

  if (!attackId || attackId.length !== 24) {
    return res.status(400).json({ success: false, message: 'Invalid attackId', code: 'VALIDATION_ERROR' });
  }

  try {
    const attack = await AttackEvent.findById(attackId).lean();
    if (!attack) {
      return res.status(404).json({ success: false, message: 'Attack not found', code: 'NOT_FOUND' });
    }

    const report = await generateReport(attack, reportType);

    logger.info(`[GeminiRoute] /report/${attackId} — generated (ai=${report.generated}, type=${reportType})`);

    return res.status(200).json({
      success: true,
      data: { report, attackId, reportType, generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /report unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate report', code: 'GEMINI_ERROR' });
  }
});

// ── GET /api/gemini/report/:attackId/export ───────────────────────────────────
// Query: ?format=markdown (default) | ?reportType=technical|executive|forensic
router.get('/report/:attackId/export', async (req, res) => {
  const { attackId } = req.params;
  const reportType = ['technical', 'executive', 'forensic'].includes(req.query?.reportType)
    ? req.query.reportType
    : 'technical';

  if (!attackId || attackId.length !== 24) {
    return res.status(400).json({ success: false, message: 'Invalid attackId', code: 'VALIDATION_ERROR' });
  }

  try {
    const attack = await AttackEvent.findById(attackId).lean();
    if (!attack) {
      return res.status(404).json({ success: false, message: 'Attack not found', code: 'NOT_FOUND' });
    }

    const report = await generateReport(attack, reportType);

    const md = [
      `# SENTINAL Incident Report`,
      ``,
      `**Attack ID:** ${attackId}`,
      `**Report Type:** ${reportType.toUpperCase()}`,
      `**Generated:** ${new Date().toISOString()}`,
      `**Risk Level:** ${report.risk_level?.toUpperCase() || 'UNKNOWN'}`,
      `**AI Generated:** ${report.generated ? 'Yes' : 'No (static fallback)'}`,
      ``,
      `---`,
      ``,
      `## Executive Summary`,
      ``,
      report.executive_summary || '_Not available_',
      ``,
      `## Technical Finding`,
      ``,
      report.technical_finding || '_Not available_',
      ``,
      `## Likely Impact`,
      ``,
      report.likely_impact || '_Not available_',
      ``,
      `## Remediation Steps`,
      ``,
      ...(Array.isArray(report.remediation_steps)
        ? report.remediation_steps.map((s, i) => `${i + 1}. ${s}`)
        : ['_Not available_']),
      ``,
      `## Next Steps`,
      ``,
      report.next_steps || '_Not available_',
      ``,
      `---`,
      ``,
      `*Generated by SENTINAL AI Security Platform — HackByte 4.0*`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sentinal-report-${attackId}-${reportType}.md"`);
    return res.send(md);
  } catch (err) {
    logger.error(`[GeminiRoute] /report/export unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to export report', code: 'GEMINI_ERROR' });
  }
});

// ── POST /api/gemini/correlate ────────────────────────────────────────────────
router.post('/correlate', geminiLimiter, async (req, res) => {
  try {
    const attacks = await AttackEvent.find().sort({ timestamp: -1 }).limit(200).lean().catch(() => []);

    if (attacks.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          campaigns: [], sharedInfrastructure: [], attackChains: [],
          riskScore: 0, summary: 'No attack data available to correlate.',
          attackCount: 0, generated: false,
        },
      });
    }

    const result = await correlate(attacks);

    // Persist snapshot for risk score trending
    try {
      await CorrelationSnapshot.create({
        riskScore:     result.riskScore || 0,
        summary:       result.summary   || '',
        attackCount:   attacks.length,
        campaignCount: result.campaigns?.length || 0,
        generated:     result.generated || false,
      });
    } catch (snapErr) {
      logger.warn(`[GeminiRoute] Failed to save correlation snapshot: ${snapErr.message}`);
    }

    logger.info(`[GeminiRoute] /correlate — done (campaigns=${result.campaigns?.length || 0}, riskScore=${result.riskScore}, generated=${result.generated})`);

    return res.status(200).json({
      success: true,
      data: { ...result, attackCount: attacks.length },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /correlate unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Correlation analysis failed.', code: 'GEMINI_ERROR' });
  }
});

// ── GET /api/gemini/correlate/history ─────────────────────────────────────────
// Returns last 20 correlation snapshots for risk score trending
router.get('/correlate/history', async (req, res) => {
  try {
    const snapshots = await CorrelationSnapshot
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return res.status(200).json({
      success: true,
      data: snapshots.reverse(), // chronological order for charting
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /correlate/history error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to fetch history', code: 'QUERY_ERROR' });
  }
});

// ── POST /api/gemini/mutate ───────────────────────────────────────────────────
router.post('/mutate', geminiLimiter, async (req, res) => {
  const { payload, attackType } = req.body;

  if (!payload || typeof payload !== 'string' || !payload.trim()) {
    return res.status(400).json({ success: false, message: 'payload is required', code: 'VALIDATION_ERROR' });
  }

  if (payload.length > 2000) {
    return res.status(400).json({ success: false, message: 'payload must be under 2000 characters', code: 'VALIDATION_ERROR' });
  }

  try {
    const result = await mutate(payload.trim(), attackType || 'unknown');

    logger.info(`[GeminiRoute] /mutate — done (variants=${result.mutations?.length || 0}, generated=${result.generated})`);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error(`[GeminiRoute] /mutate unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Mutation generation failed.', code: 'GEMINI_ERROR' });
  }
});

module.exports = router;
