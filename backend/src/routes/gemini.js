/**
 * gemini.js — Gemini AI routes
 *
 * POST /api/gemini/chat
 * POST /api/gemini/report/:attackId
 * POST /api/gemini/correlate
 * POST /api/gemini/mutate
 */

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const AttackEvent = require('../models/AttackEvent'); // correct model name
const logger     = require('../utils/logger');

const {
  chat,
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

// ── POST /api/gemini/chat ─────────────────────────────────────────────────
router.post('/chat', geminiLimiter, async (req, res) => {
  const { message, recentAttacks } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'message is required', code: 'VALIDATION_ERROR' });
  }

  try {
    let attacks = Array.isArray(recentAttacks) && recentAttacks.length > 0
      ? recentAttacks
      : await AttackEvent.find().sort({ timestamp: -1 }).limit(50).lean().catch(() => []);

    const result = await chat(message.trim(), attacks);

    logger.info(`[GeminiRoute] /chat — answered (grounded=${result.grounded}, errorCode=${result.errorCode || 'none'})`);

    return res.status(200).json({
      success: true,
      data: { answer: result.answer, grounded: result.grounded, errorCode: result.errorCode || null },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /chat unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'AI service error. Please try again.', code: 'GEMINI_ERROR' });
  }
});

// ── POST /api/gemini/report/:attackId ──────────────────────────────────────
router.post('/report/:attackId', geminiLimiter, async (req, res) => {
  const { attackId } = req.params;

  if (!attackId || attackId.length !== 24) {
    return res.status(400).json({ success: false, message: 'Invalid attackId', code: 'VALIDATION_ERROR' });
  }

  try {
    const attack = await AttackEvent.findById(attackId).lean();
    if (!attack) {
      return res.status(404).json({ success: false, message: 'Attack not found', code: 'NOT_FOUND' });
    }

    const report = await generateReport(attack);

    logger.info(`[GeminiRoute] /report/${attackId} — generated (ai=${report.generated})`);

    return res.status(200).json({
      success: true,
      data: { report, attackId, generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /report unhandled error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Failed to generate report', code: 'GEMINI_ERROR' });
  }
});

// ── POST /api/gemini/correlate ──────────────────────────────────────────────
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

// ── POST /api/gemini/mutate ─────────────────────────────────────────────────
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
