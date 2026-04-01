/**
 * SENTINAL Gateway — Express Server Entry Point
 *
 * Loads env, connects MongoDB, registers all routes, starts Socket.IO.
 * Geo-IP route added: /api/geo
 */
const path   = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const mongoose   = require('mongoose');
const logger     = require('./src/utils/logger');
const { initSocket } = require('./src/sockets/broadcastService');

// ── Route imports ─────────────────────────────────────────────────────────────
const attackRoutes      = require('./src/routes/attacks');
const alertRoutes       = require('./src/routes/alerts');
const blocklistRoutes   = require('./src/routes/blocklist');
const auditRoutes       = require('./src/routes/audit');
const logRoutes         = require('./src/routes/logs');
const statsRoutes       = require('./src/routes/stats');
const healthRoutes      = require('./src/routes/health');
const geminiRoutes      = require('./src/routes/gemini');
const nexusRoutes       = require('./src/routes/nexus');
const pcapRoutes        = require('./src/routes/pcap');
const forensicsRoutes   = require('./src/routes/forensics');
const actionsRoutes     = require('./src/routes/actions');
const serviceStatusRoutes = require('./src/routes/serviceStatus');
const geoIntelRoutes    = require('./src/routes/geoIntel');  // ← NEW
// ─────────────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

initSocket(server);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/attacks',       attackRoutes);
app.use('/api/alerts',        alertRoutes);
app.use('/api/blocklist',     blocklistRoutes);
app.use('/api/audit',         auditRoutes);
app.use('/api/logs',          logRoutes);
app.use('/api/stats',         statsRoutes);
app.use('/api/health',        healthRoutes);
app.use('/api/gemini',        geminiRoutes);
app.use('/api/nexus',         nexusRoutes);
app.use('/api/pcap',          pcapRoutes);
app.use('/api/forensics',     forensicsRoutes);
app.use('/api/actions',       actionsRoutes);
app.use('/api/services',      serviceStatusRoutes);
app.use('/api/geo',           geoIntelRoutes);   // ← NEW
// ─────────────────────────────────────────────────────────────────────────────

// ── MongoDB ───────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  logger.error('MONGO_URI is not set. Exiting.');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => logger.info('[DB] MongoDB connected'))
  .catch(err => { logger.error(`[DB] Connection failed: ${err.message}`); process.exit(1); });
// ─────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.GATEWAY_PORT || '3000', 10);
server.listen(PORT, () => {
  logger.info(`[GATEWAY] Listening on port ${PORT}`);
});

module.exports = { app, server };
