/**
 * gemini.js — Gemini AI routes
 *
 * POST /api/gemini/chat
 *   Body: { history: [{role, parts}], message: string }
 *   Returns: { success, data: { role, parts } }
 *
 * POST /api/gemini/report/:attackId
 *   Returns: { success, data: { report, attackId, generatedAt } }
 *
 * Rate limiting: both routes are gated behind a stricter limiter (20 req/min)
 * to protect Gemini API quota.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { chatWithCopilot, generateIncidentReport } = require('../services/geminiService');
const logger = require('../utils/logger');

const router = express.Router();

// Stricter rate limit for Gemini endpoints (20 requests per minute per IP)
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.', code: 'GEMINI_RATE_LIMITED' },
});

/**
 * POST /api/gemini/chat
 * Security Co-Pilot multi-turn chat endpoint.
 */
router.post('/chat', geminiLimiter, async (req, res) => {
  const { history = [], message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ success: false, message: 'message is required', code: 'VALIDATION_ERROR' });
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({ success: false, message: 'history must be an array', code: 'VALIDATION_ERROR' });
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('[GEMINI] Chat requested but GEMINI_API_KEY is not set');
    return res.status(503).json({
      success: false,
      message: 'AI service is not configured. Set GEMINI_API_KEY in your environment.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const reply = await chatWithCopilot(history, message.trim());
    return res.status(200).json({ success: true, data: reply });
  } catch (err) {
    logger.error(`[GEMINI ROUTE] chat error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'AI service error. Please try again.',
      code: 'GEMINI_ERROR',
    });
  }
});

/**
 * POST /api/gemini/report/:attackId
 * Generate a full incident report for a given attack.
 */
router.post('/report/:attackId', geminiLimiter, async (req, res) => {
  const { attackId } = req.params;

  if (!attackId || attackId.length !== 24) {
    return res.status(400).json({ success: false, message: 'Invalid attackId', code: 'VALIDATION_ERROR' });
  }

  if (!process.env.GEMINI_API_KEY) {
    logger.warn('[GEMINI] Report requested but GEMINI_API_KEY is not set');
    return res.status(503).json({
      success: false,
      message: 'AI service is not configured. Set GEMINI_API_KEY in your environment.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const result = await generateIncidentReport(attackId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    logger.error(`[GEMINI ROUTE] report error: ${err.message}`);
    const status = err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message.includes('not found') ? 'Attack not found' : 'Failed to generate report',
      code: 'GEMINI_ERROR',
    });
  }
});

module.exports = router;
