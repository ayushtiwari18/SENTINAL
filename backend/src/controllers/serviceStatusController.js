const { checkAllServices } = require('../services/serviceHealthService');

const getServiceStatus = async (req, res, next) => {
  try {
    const statuses = await checkAllServices();
    const allOnline = statuses.every(s => s.status === 'online');

    res.status(200).json({
      success: true,
      message: 'Service status retrieved',
      data: {
        overall: allOnline ? 'healthy' : 'degraded',
        services: statuses,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getServiceStatus };
