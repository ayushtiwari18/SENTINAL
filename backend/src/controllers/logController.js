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

module.exports = { ingest };
