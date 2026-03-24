const logService = require('../services/logService');

const ingest = async (req, res, next) => {
  try {
    const { projectId, method, url, ip } = req.body;

    if (!projectId || !method || !url || !ip) {
      return res.status(400).json({
        success: false,
        message: 'projectId, method, url, and ip are required',
        code: 'VALIDATION_ERROR'
      });
    }

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
