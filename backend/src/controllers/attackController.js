const attackService = require('../services/attackService');

// POST /api/attacks/report
const report = async (req, res, next) => {
  try {
    const attack = await attackService.reportAttack(req.body);
    res.status(201).json({
      success: true,
      message: 'Attack reported successfully',
      data: { id: attack._id }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/attacks/recent
const getRecent = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const attacks = await attackService.getRecentAttacks(limit);
    res.status(200).json({
      success: true,
      message: 'Recent attacks retrieved',
      data: attacks
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { report, getRecent };
