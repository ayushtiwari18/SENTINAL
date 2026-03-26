const AttackEvent = require('../models/AttackEvent');
const Alert       = require('../models/Alert');
const ActionQueue = require('../models/ActionQueue');
const emitter     = require('../utils/eventEmitter');
const { EVENTS }  = require('../sockets/broadcastService');
const axios       = require('axios');
const logger      = require('../utils/logger');

const ARMORIQ_URL = process.env.ARMORIQ_URL || 'http://localhost:8004';

/**
 * Non-blocking ArmorIQ call.
 * Called AFTER AttackEvent is saved. Never awaited from the main flow.
 * If ArmorIQ is down, system continues normally.
 */
const callArmorIQ = async (attack) => {
  try {
    const response = await axios.post(
      `${ARMORIQ_URL}/respond`,
      {
        attackId:   attack._id.toString(),
        ip:         attack.ip,
        attackType: attack.attackType,
        severity:   attack.severity,
        status:     attack.status,
        confidence: attack.confidence
      },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );

    const { actionsExecuted, actionsQueued } = response.data;

    logger.info(
      `[ARMORIQ] executed=${JSON.stringify(actionsExecuted)} ` +
      `queued=${JSON.stringify(actionsQueued.map(a => a.action))}`
    );

    // Persist each BLOCKED action into action_queue collection
    for (const item of actionsQueued) {
      const queued = await ActionQueue.create({
        attackId:      attack._id,
        action:        item.action,
        status:        'pending',
        agentReason:   item.agentReason   || '',
        blockedReason: item.blockedReason || '',
        ip:            attack.ip
      });

      // Emit Socket.io event so Dashboard ActionQueue updates live
      emitter.emit(EVENTS.ACTION_PENDING, {
        id:           queued._id,
        action:       queued.action,
        agentReason:  queued.agentReason,
        blockedReason: queued.blockedReason,
        ip:           queued.ip,
        attackId:     queued.attackId
      });

      logger.info(`[ARMORIQ] Queued for human review: ${queued.action}`);
    }

  } catch (err) {
    // ArmorIQ unreachable — log and continue. Never block detection pipeline.
    logger.warn(`[ARMORIQ] Unreachable or error: ${err.message}`);
  }
};

const reportAttack = async (data) => {
  const attack = await AttackEvent.create({
    requestId:            data.requestId,
    ip:                   data.ip,
    attackType:           data.attackType,
    severity:             data.severity,
    status:               data.status,
    detectedBy:           data.detectedBy,
    confidence:           data.confidence           || 1.0,
    payload:              data.payload              || '',
    explanation:          data.explanation          || '',
    mitigationSuggestion: data.mitigationSuggestion || '',
    responseCode:         data.responseCode         || null
  });

  // Emit real-time event immediately after save
  emitter.emit(EVENTS.ATTACK_NEW, {
    id:         attack._id,
    ip:         attack.ip,
    attackType: attack.attackType,
    severity:   attack.severity,
    status:     attack.status,
    detectedBy: attack.detectedBy,
    confidence: attack.confidence,
    timestamp:  attack.createdAt
  });

  // Auto-create Alert for high/critical
  if (['high', 'critical'].includes(data.severity)) {
    const alert = await Alert.create({
      attackId: attack._id,
      title:    `${data.attackType.toUpperCase()} Detected`,
      message:  `${data.severity} severity attack from ${data.ip}`,
      severity: data.severity,
      type:     'attack_detected',
      meta:     { attackType: data.attackType, confidence: data.confidence }
    });

    emitter.emit(EVENTS.ALERT_NEW, {
      id:        alert._id,
      title:     alert.title,
      severity:  alert.severity,
      type:      alert.type,
      timestamp: alert.createdAt
    });
  }

  // -----------------------------------------------------------------------
  // ArmorIQ enforcement — fire-and-forget, NEVER blocks the pipeline above
  // -----------------------------------------------------------------------
  callArmorIQ(attack);

  return attack;
};

const getRecentAttacks = async (limit = 20) => {
  return AttackEvent.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

module.exports = { reportAttack, getRecentAttacks };
