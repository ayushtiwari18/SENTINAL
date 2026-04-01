const AttackEvent = require('../models/AttackEvent');
const Alert       = require('../models/Alert');
const ActionQueue = require('../models/ActionQueue');
const emitter     = require('../utils/eventEmitter');
const { EVENTS }  = require('../sockets/broadcastService');
const axios       = require('axios');
const logger      = require('../utils/logger');

const NEXUS_URL = process.env.NEXUS_URL || 'http://localhost:8004';

/**
 * Non-blocking Nexus call.
 * Called AFTER AttackEvent is saved. Never awaited from the main flow.
 */
const callNexus = async (attack) => {
  try {
    const response = await axios.post(
      `${NEXUS_URL}/respond`,
      {
        attackId:   attack._id.toString(),
        ip:         attack.ip,
        attackType: attack.attackType,
        severity:   attack.severity,
        status:     attack.status,
        confidence: attack.confidence,
        // ── NEW: pass geo context to Nexus for geo-aware policy decisions ──
        geoIntel:   attack.geoIntel || null,
      },
      { timeout: 8000, headers: { 'Content-Type': 'application/json' } }
    );

    const { actionsExecuted, actionsQueued } = response.data;

    logger.info(
      `[NEXUS] executed=${JSON.stringify(actionsExecuted)} ` +
      `queued=${JSON.stringify(actionsQueued.map(a => a.action))}`
    );

    for (const item of actionsQueued) {
      const queued = await ActionQueue.create({
        attackId:      attack._id,
        action:        item.action,
        status:        'pending',
        agentReason:   item.agentReason   || '',
        blockedReason: item.blockedReason || '',
        ip:            attack.ip
      });

      emitter.emit(EVENTS.ACTION_PENDING, {
        id:            queued._id,
        action:        queued.action,
        agentReason:   queued.agentReason,
        blockedReason: queued.blockedReason,
        ip:            queued.ip,
        attackId:      queued.attackId
      });

      logger.info(`[NEXUS] Queued for human review: ${queued.action}`);
    }

  } catch (err) {
    logger.warn(`[NEXUS] Unreachable or error: ${err.message}`);
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
    responseCode:         data.responseCode         || null,
    // ── NEW: persist geo intelligence ────────────────────────────────────────
    geoIntel:             data.geoIntel             || null,
    // ─────────────────────────────────────────────────────────────────────────
  });

  emitter.emit(EVENTS.ATTACK_NEW, {
    id:         attack._id,
    ip:         attack.ip,
    attackType: attack.attackType,
    severity:   attack.severity,
    status:     attack.status,
    detectedBy: attack.detectedBy,
    confidence: attack.confidence,
    timestamp:  attack.createdAt,
    // ── NEW: broadcast geo in real-time socket event ─────────────────────────
    geoIntel:   attack.geoIntel,
    // ─────────────────────────────────────────────────────────────────────────
  });

  if (['high', 'critical'].includes(data.severity)) {
    // ── NEW: include country in alert message if available ───────────────────
    const country = data.geoIntel?.country || '';
    const countryStr = country && country !== 'Private/Local' ? ` from ${country}` : '';
    // ─────────────────────────────────────────────────────────────────────────

    const alert = await Alert.create({
      attackId: attack._id,
      title:    `${data.attackType.toUpperCase()} Detected`,
      message:  `${data.severity} severity attack from ${data.ip}${countryStr}`,
      severity: data.severity,
      type:     'attack_detected',
      meta: {
        attackType:             data.attackType,
        confidence:             data.confidence,
        // ── NEW: geo meta in alert ─────────────────────────────────────────
        country:                data.geoIntel?.country      || null,
        country_code:           data.geoIntel?.country_code || null,
        abuse_confidence_score: data.geoIntel?.abuse_confidence_score || 0,
        is_tor:                 data.geoIntel?.is_tor       || false,
        // ──────────────────────────────────────────────────────────────────
      }
    });

    emitter.emit(EVENTS.ALERT_NEW, {
      id:        alert._id,
      title:     alert.title,
      severity:  alert.severity,
      type:      alert.type,
      timestamp: alert.createdAt
    });
  }

  callNexus(attack);
  return attack;
};

const getRecentAttacks = async (limit = 20) => {
  return AttackEvent.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

module.exports = { reportAttack, getRecentAttacks };
