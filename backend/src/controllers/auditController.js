const AuditLog = require('../models/AuditLog');
const logger   = require('../utils/logger');

// POST /api/audit/ingest  — called by ArmorIQ agent
const ingestAudit = async (req, res) => {
  try {
    const {
      intent_id, action, status, reason,
      policy_rule_id, enforcement_level,
      triggeredBy, ip, attackId, meta
    } = req.body;

    const entry = await AuditLog.create({
      intent_id,
      action,
      status,        // ALLOWED | BLOCKED
      reason,
      policy_rule_id,
      enforcement_level,
      triggeredBy:   triggeredBy || 'agent',
      ip:            ip          || '',
      attackId:      attackId    || null,
      meta:          meta        || {}
    });

    logger.info(`[AUDIT] Ingested: ${action} → ${status} (rule=${policy_rule_id})`);
    res.status(201).json({ success: true, message: 'Audit entry recorded', data: { id: entry._id } });
  } catch (err) {
    logger.error('[AUDIT] ingestAudit failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
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
