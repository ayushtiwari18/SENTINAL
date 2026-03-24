const AttackEvent = require('../models/AttackEvent');
const Alert = require('../models/Alert');
const emitter = require('../utils/eventEmitter');
const { EVENTS } = require('../sockets/broadcastService');

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

    // Emit alert event
    emitter.emit(EVENTS.ALERT_NEW, {
      id:       alert._id,
      title:    alert.title,
      severity: alert.severity,
      type:     alert.type,
      timestamp: alert.createdAt
    });
  }

  return attack;
};

const getRecentAttacks = async (limit = 20) => {
  return AttackEvent.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

module.exports = { reportAttack, getRecentAttacks };
