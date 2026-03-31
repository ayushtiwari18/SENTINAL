const Alert  = require('../models/Alert');
const logger = require('../utils/logger');
const emitter = require('../utils/eventEmitter');
const { EVENTS } = require('../sockets/broadcastService');

// GET /api/alerts
const getAlerts = async (req, res, next) => {
  try {
    const limit    = parseInt(req.query.limit) || 20;
    const severity = req.query.severity;

    const query = {};
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('attackId', 'attackType ip status confidence')
      .lean();

    res.status(200).json({ success: true, message: 'Alerts retrieved', data: alerts });
  } catch (err) {
    logger.error(`[ALERTS] ${err.message}`);
    next(err);
  }
};

// PATCH /api/alerts/:id/read
const markRead = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found', code: 'NOT_FOUND' });
    }
    res.status(200).json({ success: true, message: 'Alert marked read', data: alert });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/alerts/Nexus
 * Called by Nexus executor after 'send_alert' action is ALLOWED by policy.
 * Creates a persisted alert and emits alert:new over Socket.io.
 */
const ingestNexusAlert = async (req, res, next) => {
  try {
    const { attackId, ip, attackType, severity, message, source } = req.body;

    const alert = await Alert.create({
      attackId: attackId || null,
      title:    `[Nexus] ${(attackType || 'ATTACK').toUpperCase()} Alert`,
      message:  message  || `Nexus triggered alert for ${ip}`,
      severity: severity || 'high',
      type:     'Nexus_action',
      meta:     { ip, attackType, source: source || 'sentinal-response-engine' }
    });

    emitter.emit(EVENTS.ALERT_NEW, {
      id:        alert._id,
      title:     alert.title,
      severity:  alert.severity,
      type:      alert.type,
      timestamp: alert.createdAt
    });

    logger.info(`[ALERTS] Nexus alert ingested: ${alert.title}`);
    res.status(201).json({ success: true, message: 'Nexus alert recorded', data: { id: alert._id } });
  } catch (err) {
    logger.error(`[ALERTS] ingestNexusAlert failed: ${err.message}`);
    next(err);
  }
};

module.exports = { getAlerts, markRead, ingestNexusAlert };
