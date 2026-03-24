const statsService = require('../services/statsService');

const getStats = async (req, res, next) => {
  try {
    const stats = await statsService.getStats();
    res.status(200).json({
      success: true,
      message: 'Stats retrieved successfully',
      data: stats
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getStats };
