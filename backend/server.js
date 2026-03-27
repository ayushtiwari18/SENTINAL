require('dotenv').config();
const http     = require('http');
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const morgan   = require('morgan');
const helmet   = require('helmet');

const { connectDB }            = require('./src/config/database');  // named export
const { initSocketServer }     = require('./src/sockets/socketServer');
const logger                   = require('./src/utils/logger');
const { globalLimiter }        = require('./src/middleware/rateLimiter');

// ── Process-level safety nets ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error(`[SERVER] Uncaught Exception: ${err.message}`);
  // Do NOT exit — keep server alive for other requests
});
process.on('unhandledRejection', (reason) => {
  logger.error(`[SERVER] Unhandled Rejection: ${reason}`);
});

// ── MongoDB disconnect auto-reconnect ───────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  logger.warn('[DATABASE] MongoDB Atlas disconnected. Attempting reconnect...');
  setTimeout(() => connectDB(), 5000);
});
mongoose.connection.on('reconnected', () => {
  logger.info('[DATABASE] MongoDB Atlas reconnected successfully.');
});
mongoose.connection.on('error', (err) => {
  logger.error(`[DATABASE] MongoDB connection error: ${err.message}`);
});

const app        = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(globalLimiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

// ── Existing Routes ───────────────────────────────────────────────────────────────────
app.use('/api/logs',           require('./src/routes/logs'));
app.use('/api/attacks',        require('./src/routes/attacks'));
app.use('/api/attacks',        require('./src/routes/forensics'));
app.use('/api/stats',          require('./src/routes/stats'));
app.use('/api/service-status', require('./src/routes/serviceStatus'));
app.use('/api/alerts',         require('./src/routes/alerts'));
app.use('/api/health',         require('./src/routes/health'));
app.use('/api/pcap',           require('./src/routes/pcap'));

// ── ArmorIQ Routes ───────────────────────────────────────────────────────────────────
app.use('/api/actions',  require('./src/routes/actions'));
app.use('/api/audit',    require('./src/routes/audit'));
app.use('/api/armoriq',  require('./src/routes/armoriq'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({ success: false, message: 'Internal server error', code: 'SERVER_ERROR' });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    initSocketServer(httpServer);
    httpServer.listen(PORT, () => {
      logger.info(`[SERVER] SENTINEL Gateway running on port ${PORT}`);
      logger.info(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`[SERVER] MongoDB Atlas: ${process.env.MONGO_URI ? 'URI loaded ✓' : 'URI MISSING ✗'}`);
    });
  });
}

module.exports = { app, httpServer };
