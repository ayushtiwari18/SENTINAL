'use strict';
/**
 * Express adapter for sentinel-middleware.
 * Usage:
 *   const { sentinel } = require('sentinel-middleware');
 *   app.use(sentinel({ projectId: 'my-app', gatewayUrl: 'http://...' }));
 */
const { resolveConfig, scrubBody, extractIP } = require('../config');
const { buildClient, send } = require('../sender');

function sentinel(opts = {}) {
  const cfg    = resolveConfig(opts);
  const client = buildClient(cfg);

  return function sentinelMiddleware(req, res, next) {
    const start = Date.now();

    // Sample rate check
    if (cfg.sampleRate < 1.0 && Math.random() > cfg.sampleRate) {
      return next();
    }

    // Ignore listed routes
    const path = req.path || req.url?.split('?')[0] || '/';
    if (cfg.ignoreRoutes.some(r => path.startsWith(r))) {
      return next();
    }

    // Ignore listed IPs
    const ip = extractIP(req);
    if (cfg.ignoreIPs.includes(ip)) {
      return next();
    }

    // Fire after response is fully sent
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
