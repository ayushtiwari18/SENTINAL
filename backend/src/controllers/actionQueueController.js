const ActionQueue = require('../models/ActionQueue');
const AuditLog    = require('../models/AuditLog');
const emitter     = require('../utils/eventEmitter');
const logger      = require('../utils/logger');

// GET /api/actions/pending
const getPending = async (req, res) => {
  try {
    const items = await ActionQueue.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-__v');
    res.json({ success: true, message: 'Pending actions', data: items });
  } catch (err) {
    logger.error('[ACTIONS] getPending failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

// POST /api/actions/:id/approve
const approveAction = async (req, res) => {
  try {
    const item = await ActionQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Action not found', code: 'NOT_FOUND' });
    if (item.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Action is not pending', code: 'BAD_REQUEST' });
    }

    item.status     = 'approved';
    item.approvedBy = req.body.approvedBy || 'human';
    item.approvedAt = new Date();
    await item.save();

    await AuditLog.create({
      action:            item.action,
      status:            'APPROVED',
      reason:            'Human approved pending action',
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'ArmorIQ-Policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id) }
    });

    logger.info(`[ACTIONS] APPROVED: ${item.action} for attackId=${item.attackId}`);
    res.json({ success: true, message: 'Action approved', data: item });
  } catch (err) {
    logger.error('[ACTIONS] approveAction failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

// POST /api/actions/:id/reject
const rejectAction = async (req, res) => {
  try {
    const item = await ActionQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Action not found', code: 'NOT_FOUND' });
    if (item.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Action is not pending', code: 'BAD_REQUEST' });
    }

    item.status     = 'rejected';
    item.approvedBy = req.body.rejectedBy || 'human';
    item.approvedAt = new Date();
    await item.save();

    await AuditLog.create({
      action:            item.action,
      status:            'REJECTED',
      reason:            'Human rejected pending action',
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'ArmorIQ-Policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id) }
    });

    logger.info(`[ACTIONS] REJECTED: ${item.action} for attackId=${item.attackId}`);
    res.json({ success: true, message: 'Action rejected', data: item });
  } catch (err) {
    logger.error('[ACTIONS] rejectAction failed:', err.message);
    res.status(500).json({ success: false, message: 'Server error', code: 'SERVER_ERROR' });
  }
};

module.exports = { getPending, approveAction, rejectAction };
