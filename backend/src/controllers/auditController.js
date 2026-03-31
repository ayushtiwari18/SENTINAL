const AuditLog = require('../models/AuditLog');
const logger   = require('../utils/logger');
const emitter  = require('../utils/eventEmitter');
const { EVENTS } = require('../sockets/broadcastService');

// POST /api/audit/ingest  — called by Nexus agent
const ingestAudit = async (req, res) => {
  try {
    const {
      intent_id, action, status, reason,
      policy_rule_id, enforcement_level,
      triggeredBy, ip, attackId, meta
    } = req.body;

    // Validate required fields
    if (!action || !status) {
      return res.status(400).json({
        success: false,
        message: 'action and status are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Normalise status to uppercase
    const normStatus = (status || '').toUpperCase();
    const allowed    = ['ALLOWED', 'BLOCKED', 'APPROVED', 'REJECTED'];
    if (!allowed.includes(normStatus)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of ${allowed.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    const entry = await AuditLog.create({
      intent_id:         intent_id         || null,
      action,
      status:            normStatus,
      reason:            reason            || '',
      policy_rule_id:    policy_rule_id    || '',
      enforcement_level: enforcement_level || 'Nexus-Policy-v1',
      triggeredBy:       triggeredBy       || 'agent',
      ip:                ip                || '',
      attackId:          attackId          ? String(attackId) : null,
      meta:              meta              || {}
    });

    // Emit real-time socket event so Dashboard AuditLog panel updates live
    emitter.emit(EVENTS.AUDIT_NEW, {
      id:             entry._id,
      action:         entry.action,
      status:         entry.status,
      reason:         entry.reason,
      policy_rule_id: entry.policy_rule_id,
      triggeredBy:    entry.triggeredBy,
      ip:             entry.ip,
      attackId:       entry.attackId,
      timestamp:      entry.createdAt
    });

    logger.info(`[AUDIT] Ingested: ${action} → ${normStatus} (rule=${policy_rule_id})`);
    res.status(201).json({ success: true, message: 'Audit entry recorded', data: { id: entry._id } });
  } catch (err) {
    logger.error('[AUDIT] ingestAudit failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR', detail: err.message });
  }
};

// GET /api/audit?limit=50
const getAuditLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const entries = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');
    res.json({ success: true, message: 'Audit log', data: entries });
  } catch (err) {
    logger.error('[AUDIT] getAuditLog failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

module.exports = { ingestAudit, getAuditLog };
