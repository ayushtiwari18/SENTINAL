/**
 * SENTINAL Gateway — Entry Point
 *
 * STARTUP ORDER (must not be changed):
 *   1. dotenv      — load root .env FIRST
 *   2. validateEnv — verify all required vars, exit if missing
 *   3. Express app setup
 *   4. Database connection
 *   5. Socket.io init
 *   6. Listen
 */
const path = require('path');

// Step 1 — Load environment from root .env
require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

// Step 2 — Validate required env vars before anything else
const { validateEnv } = require('../config/envValidator');
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const morgan  = require('morgan');
const helmet  = require('helmet');

const { connectDB }        = require('./src/config/database');
const { initSocketServer } = require('./src/sockets/socketServer');
const logger               = require('./src/utils/logger');
const { globalLimiter }    = require('./src/middleware/rateLimiter');

// ── Process-level safety nets ───────────────────────────────────────────────────
process.on('uncaughtException',  err    => logger.error(`[SERVER] Uncaught Exception: ${err.message}`));
process.on('unhandledRejection', reason => logger.error(`[SERVER] Unhandled Rejection: ${reason}`));

// ── MongoDB auto-reconnect ────────────────────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  logger.warn('[DATABASE] MongoDB disconnected. Reconnecting in 5s...');
  setTimeout(() => connectDB(), 5000);
});
mongoose.connection.on('reconnected', () => logger.info('[DATABASE] MongoDB reconnected.'));
mongoose.connection.on('error', err => logger.error(`[DATABASE] Error: ${err.message}`));

const app        = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(globalLimiter);

// FIX: explicit CORS config with allowed methods and preflight handler.
// Without this, POST requests with Content-Type: application/json (like
// approve/reject) trigger an OPTIONS preflight that was silently dropped,
// causing axios to throw a network error and the UI to appear blank.
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
// Explicitly handle preflight for all routes
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: logger.stream }));
}

// ── Root health check — no auth, no DB required ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:  'ok',
    service: 'gateway',
    uptime:  Math.floor(process.uptime()),
    port:    parseInt(process.env.GATEWAY_PORT || '3000')
  });
});

// ── API Routes ──────────────────────────────────────────────────────────────────────────────
app.use('/api/logs',           require('./src/routes/logs'));
app.use('/api/attacks',        require('./src/routes/attacks'));
app.use('/api/attacks',        require('./src/routes/forensics'));
app.use('/api/stats',          require('./src/routes/stats'));
app.use('/api/service-status', require('./src/routes/serviceStatus'));
app.use('/api/alerts',         require('./src/routes/alerts'));
app.use('/api/health',         require('./src/routes/health'));   // detailed health with DB status
app.use('/api/pcap',           require('./src/routes/pcap'));
app.use('/api/actions',        require('./src/routes/actions'));
app.use('/api/audit',          require('./src/routes/audit'));
app.use('/api/armoriq',        require('./src/routes/armoriq'));
// ── Gemini AI routes (Co-Pilot + Incident Report) ──────────────────────────────
app.use('/api/gemini',         require('./src/routes/gemini'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', code: 'NOT_FOUND' });
});

// Global Error Handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error(err.message);
  res.status(500).json({ success: false, message: 'Internal server error', code: 'SERVER_ERROR' });
});

// ── Startup ──────────────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.GATEWAY_PORT || process.env.PORT || '3000');

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    initSocketServer(httpServer);
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`[SERVER] ✓ SENTINAL Gateway  →  http://0.0.0.0:${PORT}`);
      logger.info(`[SERVER]   Health check   →  http://0.0.0.0:${PORT}/health`);
      logger.info(`[SERVER]   Environment    : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`[SERVER]   Detection      : ${process.env.DETECTION_URL || process.env.DETECTION_ENGINE_URL || 'http://localhost:8002'}`);
      logger.info(`[SERVER]   ArmorIQ        : ${process.env.ARMORIQ_URL || 'http://localhost:8004'}`);
      logger.info(`[SERVER]   PCAP           : ${process.env.PCAP_URL || process.env.PCAP_SERVICE_URL || 'http://localhost:8003'}`);
      logger.info(`[SERVER]   Gemini AI      : ${process.env.GEMINI_API_KEY ? 'enabled ✓' : 'disabled (set GEMINI_API_KEY)'}`);
    });
  });
}

module.exports = { app, httpServer };
