require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health Check Route
app.get('/health', (req, res) => {
  const dbStatus = require('mongoose').connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  res.status(200).json({
    success: true,
    message: "Operation successful",
    data: {
      status: "ok",
      uptime: process.uptime(),
      dbStatus: dbStatus === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "NOT_FOUND"
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "SERVER_ERROR"
  });
});

// Start server only if not in test mode
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`[SERVER] SENTINEL Gateway running on port ${PORT}`);
    });
  });
}

module.exports = app;
