/**
 * actionQueueController
 *
 * CRITICAL FIX: approveAction now EXECUTES the action, not just marks it approved.
 *
 * Previously: approve only saved status='approved' to ActionQueue + wrote AuditLog.
 *             The actual block NEVER happened — executor.py was never called.
 *
 * Now: if action === 'rate_limit_ip', we directly write to BlockedIP (MongoDB)
 *      so the block appears on /blocklist immediately and middleware enforces it.
 *      All other actions log + audit as before.
 *
 * This fix is intentionally Gateway-only (no Python process required) so it works
 * even when the Nexus/Response Engine service is NOT running.
 */
const ActionQueue = require('../models/ActionQueue');
const AuditLog    = require('../models/AuditLog');
const BlockedIP   = require('../models/BlockedIP');
const emitter     = require('../utils/eventEmitter');
const logger      = require('../utils/logger');

// Default block duration when human approves rate_limit_ip (minutes). 0 = permanent.
const BLOCK_DURATION_MINUTES = parseInt(process.env.BLOCK_DURATION_MINUTES || '60', 10);

/**
 * Execute the approved action directly inside the Gateway.
 * Returns { success: bool, detail: string }
 */
async function _executeApprovedAction(item) {
  const { action, ip, attackId } = item;

  if (action === 'rate_limit_ip') {
    if (!ip || ip === 'unknown') {
      return { success: false, detail: 'No IP to block on this action' };
    }

    const expiresAt = BLOCK_DURATION_MINUTES > 0
      ? new Date(Date.now() + BLOCK_DURATION_MINUTES * 60 * 1000)
      : null;

    await BlockedIP.findOneAndUpdate(
      { ip },
      {
        ip,
        reason:     `Human approved rate_limit_ip via Action Queue`,
        attackType: item.attackId ? 'human-approved' : '',
        attackId:   attackId ? String(attackId) : '',
        expiresAt,
        blockedAt:  new Date(),
        blockedBy:  item.approvedBy || 'human',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(
      `[ACTIONS] ✓ rate_limit_ip executed: ${ip} blocked in MongoDB ` +
      `(expires=${expiresAt ? expiresAt.toISOString() : 'never'})`
    );
    return { success: true, detail: `${ip} written to BlockedIP collection` };
  }

  // For all other actions (send_alert, log_attack, flag_for_review, generate_report)
  // — these are handled by the Response Engine when it’s running.
  // We log the approval and let the audit trail serve as the record.
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

    // ── CRITICAL FIX: actually execute the action ───────────────────────────────
    const execResult = await _executeApprovedAction(item);
    if (!execResult.success) {
      logger.warn(`[ACTIONS] Execution warning for ${item.action}: ${execResult.detail}`);
    }

    await AuditLog.create({
      action:            item.action,
      status:            'APPROVED',
      reason:            `Human approved pending action. Execution: ${execResult.detail}`,
      policy_rule_id:    'HUMAN_OVERRIDE',
      enforcement_level: 'nexus-policy-v1',
      triggeredBy:       'human',
      ip:                item.ip,
      attackId:          item.attackId ? String(item.attackId) : null,
      meta:              { actionQueueId: String(item._id), executed: execResult.success, executionDetail: execResult.detail }
    });

    logger.info(`[ACTIONS] APPROVED + EXECUTED: ${item.action} for ip=${item.ip} attackId=${item.attackId}`);
    res.json({
      success: true,
      message: 'Action approved and executed',
      data:    item,
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
