'use strict';
/**
 * Express adapter for sentinel-middleware.
 *
 * Usage:
 *   const { sentinel } = require('sentinel-middleware');
 *   app.use(sentinel({ projectId: 'my-app', gatewayUrl: 'http://...' }));
 *
 * Phase 5 upgrade: IP block enforcement added.
 * Before forwarding any request, the middleware checks Gateway /api/blocklist/check/:ip.
 * Blocked IPs receive an immediate 403 response — the request never reaches the app.
 *
 * Performance: a 30-second in-memory cache prevents a MongoDB round-trip on every
 * single request while still picking up new blocks within 30 seconds.
 * Fail-open: if Gateway is unreachable, the check returns false (do NOT block).
 */
const { resolveConfig, scrubBody, extractIP } = require('../config');
const { buildClient, send }                   = require('../sender');

// ── In-memory blocklist cache ──────────────────────────────────────────────────────
const _blockCache  = new Map();   // ip → { blocked: bool, expiresAt: ms }
const CACHE_TTL_MS = 30_000;      // re-query MongoDB every 30 seconds per IP

/**
 * Check whether an IP is currently blocked.
 * Uses local cache; falls back to Gateway API on cache miss or expiry.
 * Fail-open: returns false if Gateway is unreachable.
 *
 * @param {string} ip
 * @param {object} cfg  — resolved sentinel config (needs cfg.gatewayUrl)
 * @returns {Promise<boolean>}
 */
async function isBlocked(ip, cfg) {
  const now    = Date.now();
  const cached = _blockCache.get(ip);

  // Return cached value if still fresh
  if (cached && cached.expiresAt > now) {
    return cached.blocked;
  }

  try {
    const res  = await fetch(`${cfg.gatewayUrl}/api/blocklist/check/${encodeURIComponent(ip)}`);
    const data = await res.json();
    _blockCache.set(ip, { blocked: !!data.blocked, expiresAt: now + CACHE_TTL_MS });
    return !!data.blocked;
  } catch {
    // Fail-open — if Gateway is down, never block a legitimate request
    return false;
  }
}

function sentinel(opts = {}) {
  const cfg    = resolveConfig(opts);
  const client = buildClient(cfg);

  return async function sentinelMiddleware(req, res, next) {
    const start = Date.now();

    // ── Sample rate check ──────────────────────────────────────────────────
    if (cfg.sampleRate < 1.0 && Math.random() > cfg.sampleRate) {
      return next();
    }

    // ── Ignore listed routes ───────────────────────────────────────────────
    const path = req.path || req.url?.split('?')[0] || '/';
    if (cfg.ignoreRoutes.some(r => path.startsWith(r))) {
      return next();
    }

    // ── Extract IP ────────────────────────────────────────────────────────────
    const ip = extractIP(req);

    // ── Ignore whitelisted IPs ──────────────────────────────────────────────
    if (cfg.ignoreIPs.includes(ip)) {
      return next();
    }

    // ── BLOCK CHECK — enforces MongoDB blocklist ──────────────────────────────
    // Checked BEFORE the request is forwarded to the target application.
    // Blocked IPs receive 403 immediately; request is never processed.
    if (await isBlocked(ip, cfg)) {
      return res.status(403).json({
        error:   'Forbidden',
        code:    'IP_BLOCKED',
        message: 'Your IP address has been blocked by SENTINAL security policy.',
      });
    }

    // ── Fire telemetry after response is fully sent ───────────────────────────
    res.on('finish', () => {
      const payload = {
        projectId:        cfg.projectId,
        method:           req.method,
        url:              req.originalUrl || req.url,
        ip,
        queryParams:      req.query  || {},
        body:             scrubBody(req.body, cfg.maxBodySize),
        headers: {
          userAgent:   req.headers['user-agent']   || '',
          contentType: req.headers['content-type'] || '',
          referer:     req.headers['referer']      || '',
        },
        responseCode:     res.statusCode,
        processingTimeMs: Date.now() - start,
      };

      // Fire-and-forget — never blocks the request
      send(client, payload, cfg);
    });

    next();
  };
}

module.exports = { sentinel };
