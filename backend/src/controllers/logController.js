const logService = require('../services/logService');

// Validation now handled by Joi middleware — controller stays thin
const ingest = async (req, res, next) => {
  try {
    const log = await logService.ingestLog(req.body);
    res.status(201).json({
      success: true,
      message: 'Log ingested successfully',
      data: { id: log._id }
    });
  } catch (err) {
    next(err);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await logService.getRecentLogs(limit);
    res.status(200).json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { ingest, getLogs };
