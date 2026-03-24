const SystemLog = require('../models/SystemLog');
const AttackEvent = require('../models/AttackEvent');
const Alert = require('../models/Alert');

const getStats = async () => {
  const [
    totalLogs,
    totalAttacks,
    totalAlerts,
    unreadAlerts,
    attacksByType,
    attacksBySeverity
  ] = await Promise.all([
    SystemLog.countDocuments(),
    AttackEvent.countDocuments(),
    Alert.countDocuments(),
    Alert.countDocuments({ isRead: false }),
    AttackEvent.aggregate([
      { $group: { _id: '$attackType', count: { $sum: 1 } } }
    ]),
    AttackEvent.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } }
    ])
  ]);

  return {
    totalLogs,
    totalAttacks,
    totalAlerts,
    unreadAlerts,
    attacksByType:     Object.fromEntries(attacksByType.map(a => [a._id, a.count])),
    attacksBySeverity: Object.fromEntries(attacksBySeverity.map(a => [a._id, a.count]))
  };
};

module.exports = { getStats };
