/**
 * ArmorIQ Trigger Route
 * POST /api/armoriq/trigger
 *
 * Creates a REAL AttackEvent in MongoDB and immediately triggers
 * the ArmorIQ enforcement pipeline. Does NOT require the Detection
 * Engine to be running. Use this for demos and testing.
 *
 * Body: { ip, attackType, severity, confidence, status }
 */
const express  = require('express');
const router   = express.Router();
const attackService = require('../services/attackService');
const logger   = require('../utils/logger');

const VALID_SEVERITIES   = ['low', 'medium', 'high', 'critical'];
const VALID_ATTACK_TYPES = [
  'sqli', 'xss', 'traversal', 'command_injection',
  'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe', 'webshell', 'unknown'
];

// POST /api/armoriq/trigger
router.post('/trigger', async (req, res) => {
  try {
    const {
      ip          = '10.0.0.1',
      attackType  = 'sqli',
      severity    = 'critical',
      confidence  = 0.97,
      status      = 'successful'
    } = req.body;

    // Basic validation
    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }
    if (!VALID_ATTACK_TYPES.includes(attackType)) {
      return res.status(400).json({
        success: false,
        message: `attackType must be one of: ${VALID_ATTACK_TYPES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    logger.info(`[ARMORIQ-TRIGGER] Simulating ${attackType} attack from ${ip} (${severity})`);

    // reportAttack saves AttackEvent + calls ArmorIQ fire-and-forget
    const attack = await attackService.reportAttack({
      requestId:            null,
      ip,
      attackType,
      severity,
      status,
      detectedBy:           'armoriq-trigger',
      confidence:           parseFloat(confidence) || 0.97,
      payload:              `Simulated ${attackType} attack for ArmorIQ demo`,
      explanation:          `Demo trigger: ${attackType} with ${severity} severity`,
      mitigationSuggestion: 'ArmorIQ will evaluate and enforce policy',
      responseCode:         200
    });

    logger.info(`[ARMORIQ-TRIGGER] AttackEvent created: ${attack._id}`);

    res.status(201).json({
      success: true,
      message: 'Attack simulated — ArmorIQ enforcement triggered',
      data: {
        attackId:   attack._id,
        ip,
        attackType,
        severity,
        confidence,
        note: 'Check /api/actions/pending and /api/audit in ~1 second'
      }
    });
  } catch (err) {
    logger.error(`[ARMORIQ-TRIGGER] Error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Trigger failed',
      code: 'SERVER_ERROR',
      detail: err.message
    });
  }
});

module.exports = router;
