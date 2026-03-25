const mongoose = require('mongoose');

const getHealth = (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.status(200).json({
    success: true,
    message: 'Operation successful',
    data: {
      status:    'ok',
      uptime:    process.uptime(),
      dbStatus:  dbState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = { getHealth };
