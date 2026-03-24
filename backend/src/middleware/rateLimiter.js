const rateLimit = require('express-rate-limit');

const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 100,               // max 100 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests — slow down',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

module.exports = { ingestLimiter, globalLimiter };
