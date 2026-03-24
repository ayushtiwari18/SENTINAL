const attackService = require('../services/attackService');

// Validation now handled by Joi middleware — controller stays thin
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

module.exports = { report };
