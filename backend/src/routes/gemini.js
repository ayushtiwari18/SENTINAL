/**
 * /api/gemini — SENTINAL Gemini AI routes
 *
 * POST /api/gemini/chat
 *   Body: { question: string }
 *   Returns: { success, data: { answer, grounded, context_attacks, errorCode? } }
 *
 * POST /api/gemini/report/:attackId
 *   Returns: { success, data: { report } }
 */

const express       = require('express');
const router        = express.Router();
const AttackEvent   = require('../models/AttackEvent');
const geminiService = require('../services/geminiService');
const logger        = require('../utils/logger');

// ── POST /api/gemini/chat ────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({
      success: false,
      message: 'question is required and must be a non-empty string',
      code: 'MISSING_QUESTION',
    });
  }

  if (question.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: 'question must be 500 characters or fewer',
      code: 'QUESTION_TOO_LONG',
    });
  }

  try {
    const recentAttacks = await AttackEvent
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    const result = await geminiService.chat(question.trim(), recentAttacks);

    logger.info(`[GeminiRoute] /chat — answered (grounded=${result.grounded}, errorCode=${result.errorCode || 'none'})`);

    // Return 429 to frontend when quota is exhausted so UI can show correct state
    const httpStatus = result.errorCode === 'QUOTA_EXHAUSTED' ? 429
                     : result.errorCode === 'NO_API_KEY'      ? 503
                     : 200;

    return res.status(httpStatus).json({
      success: httpStatus === 200,
      data: {
        answer:          result.answer,
        grounded:        result.grounded,
        context_attacks: recentAttacks.length,
        errorCode:       result.errorCode || null,
      },
    });
  } catch (err) {
    logger.error(`[GeminiRoute] /chat error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to process question',
      code: 'GEMINI_CHAT_ERROR',
    });
  }
});

// ── POST /api/gemini/report/:attackId ────────────────────────────────────────
router.post('/report/:attackId', async (req, res) => {
  const { attackId } = req.params;

  if (!attackId || attackId.length < 10) {
    return res.status(400).json({
      success: false,
      message: 'Valid attackId is required',
      code: 'MISSING_ATTACK_ID',
    });
  }

  let attack;
  try {
    attack = await AttackEvent.findById(attackId).lean();
  } catch {
    return res.status(400).json({
      success: false,
      message: 'Invalid attack ID format',
      code: 'INVALID_ID',
    });
  }

  if (!attack) {
    return res.status(404).json({
      success: false,
      message: 'Attack event not found',
      code: 'ATTACK_NOT_FOUND',
    });
  }

  try {
    const report = await geminiService.generateReport(attack);
    logger.info(`[GeminiRoute] /report — done for ${attackId} (gemini=${report.generated})`);
    return res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    logger.error(`[GeminiRoute] /report error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate incident report',
      code: 'GEMINI_REPORT_ERROR',
    });
  }
});

module.exports = router;
