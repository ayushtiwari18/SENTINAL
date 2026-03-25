const Alert = require('../models/Alert');
const logger = require('../utils/logger');

// GET /api/alerts
const getAlerts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const severity = req.query.severity; // optional filter

    const query = {};
    if (severity) query.severity = severity;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('attackId', 'attackType ip status confidence')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Alerts retrieved',
      data: alerts
    });
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

module.exports = { getAlerts, markRead };
