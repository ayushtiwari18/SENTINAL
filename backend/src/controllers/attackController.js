const attackService = require('../services/attackService');
const mongoose = require('mongoose');

const VALID_ATTACK_TYPES = [
  'sqli','xss','traversal','command_injection',
  'ssrf','lfi_rfi','brute_force','hpp','xxe','webshell','unknown'
];
const VALID_SEVERITIES  = ['low', 'medium', 'high', 'critical'];
const VALID_STATUSES    = ['attempt', 'successful', 'blocked'];
const VALID_DETECTED_BY = ['rule', 'ml', 'both'];

const report = async (req, res, next) => {
  try {
    const { requestId, ip, attackType, severity, status, detectedBy } = req.body;

    if (!requestId || !ip || !attackType || !severity || !status || !detectedBy) {
      return res.status(400).json({
        success: false,
        message: 'requestId, ip, attackType, severity, status, detectedBy are required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({
        success: false,
        message: 'requestId must be a valid ObjectId',
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

    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    if (!VALID_DETECTED_BY.includes(detectedBy)) {
      return res.status(400).json({
        success: false,
        message: `detectedBy must be one of: ${VALID_DETECTED_BY.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const attack = await attackService.reportAttack(req.body);

    res.status(201).json({
      success: true,
      message: 'Attack reported successfully',
      data: { id: attack._id }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { report };
