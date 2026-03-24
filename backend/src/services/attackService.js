const AttackEvent = require('../models/AttackEvent');
const Alert = require('../models/Alert');

const reportAttack = async (data) => {
  const attack = await AttackEvent.create({
    requestId:          data.requestId,
    ip:                 data.ip,
    attackType:         data.attackType,
    severity:           data.severity,
    status:             data.status,
    detectedBy:         data.detectedBy,
    confidence:         data.confidence         || 1.0,
    payload:            data.payload            || '',
    explanation:        data.explanation        || '',
    mitigationSuggestion: data.mitigationSuggestion || '',
    responseCode:       data.responseCode       || null
  });

  // Auto-create Alert for high/critical attacks
  if (['high', 'critical'].includes(data.severity)) {
    await Alert.create({
      attackId: attack._id,
      title:    `${data.attackType.toUpperCase()} Detected`,
      message:  `${data.severity} severity attack from ${data.ip}`,
      severity: data.severity,
      type:     'attack_detected',
      meta:     { attackType: data.attackType, confidence: data.confidence }
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
