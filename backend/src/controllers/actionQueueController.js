/**
 * actionQueueController
 *
 * CRITICAL FIX v2: Handle both 'rate_limit_ip' AND 'permanent_ban_ip' actions.
 *
 * Nexus queues two types of IP block actions:
 *   - rate_limit_ip     → temporary block (BLOCK_DURATION_MINUTES, default 60min)
 *   - permanent_ban_ip  → permanent block (expiresAt: null, never auto-deleted)
 *
 * Both now write directly to BlockedIP MongoDB collection inside the Gateway.
 * No Python / Response Engine process required.
 */
const ActionQueue = require('../models/ActionQueue');
const AuditLog    = require('../models/AuditLog');
const BlockedIP   = require('../models/BlockedIP');
const emitter     = require('../utils/eventEmitter');
const logger      = require('../utils/logger');

// Duration for temporary rate-limit blocks (minutes). 0 = permanent.
const BLOCK_DURATION_MINUTES = parseInt(process.env.BLOCK_DURATION_MINUTES || '60', 10);

/**
 * Execute the approved action directly inside the Gateway.
 * Returns { success: bool, detail: string }
 */
async function _executeApprovedAction(item) {
  const { action, ip, attackId, agentReason } = item;

  // ── IP blocking actions ───────────────────────────────────────────────────
  if (action === 'rate_limit_ip' || action === 'permanent_ban_ip') {
    if (!ip || ip === 'unknown') {
      return { success: false, detail: `No valid IP to block for action '${action}'` };
    }

    // permanent_ban_ip  → expiresAt: null  (MongoDB TTL index ignores null, so never deleted)
    // rate_limit_ip     → expiresAt: now + BLOCK_DURATION_MINUTES
    const isPermanent = action === 'permanent_ban_ip';
    const expiresAt   = isPermanent
      ? null
      : BLOCK_DURATION_MINUTES > 0
        ? new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000)
        : null;

    await BlockedIP.findOneAndUpdate(
      { ip },
      {
        ip,
        reason:     agentReason || `${action} approved via Action Queue`,
        attackType: 'nexus-approved',
        attackId:   attackId ? String(attackId) : '',
        expiresAt,
        blockedAt:  new Date(),
        blockedBy:  item.approvedBy || 'human',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const expiryLabel = expiresAt ? expiresAt.toISOString() : 'never (permanent)';
    logger.info(
      `[ACTIONS] ✓ ${action} executed: ${ip} blocked in MongoDB (expires=${expiryLabel})`
    );
    return {
      success: true,
      detail:  `${ip} written to BlockedIP — ${isPermanent ? 'PERMANENT' : `expires in ${BLOCK_DURATION_MINUTES}min`}`,
    };
  }

  // ── All other actions ─────────────────────────────────────────────────────
  // send_alert, log_attack, flag_for_review, generate_report, shutdown_endpoint
  // are handled by the Response Engine when running; acknowledge here.
  logger.info(`[ACTIONS] action='${action}' approved — no Gateway-side execution needed`);
  return { success: true, detail: `${action} acknowledged (no Gateway-side execution)` };
}

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

    // Actually execute the action
    const execResult = await _executeApprovedAction(item);
    if (!execResult.success) {
      logger.warn(`[ACTIONS] Execution warning for ${item.action}: ${execResult.detail}`);
    }

    await AuditLog.create({
      action:            item.action,
      status:            'APPROVED',
      reason:            `Human approved. Execution: ${execResult.detail}`,
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'nexus-policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id), executed: execResult.success, executionDetail: execResult.detail }
    });

    logger.info(`[ACTIONS] APPROVED + EXECUTED: ${item.action} for ip=${item.ip} attackId=${item.attackId}`);
    res.json({
      success:   true,
      message:   'Action approved and executed',
      data:      item,
      execution: execResult,
    });
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
      enforcement_level: 'nexus-policy-v1',
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
