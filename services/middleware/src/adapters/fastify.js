'use strict';
/**
 * Fastify plugin adapter for sentinel-middleware.
 * Usage:
 *   const { sentinelFastify } = require('sentinel-middleware/fastify');
 *   fastify.register(sentinelFastify, { projectId: 'my-app', gatewayUrl: 'http://...' });
 */
const { resolveConfig, scrubBody, extractIP } = require('../config');
const { buildClient, send } = require('../sender');

async function sentinelFastify(fastify, opts) {
  const cfg    = resolveConfig(opts);
  const client = buildClient(cfg);

  fastify.addHook('onResponse', async (request, reply) => {
    // Sample rate check
    if (cfg.sampleRate < 1.0 && Math.random() > cfg.sampleRate) return;

    const path = request.routerPath || request.url?.split('?')[0] || '/';
    if (cfg.ignoreRoutes.some(r => path.startsWith(r))) return;

    const ip = extractIP(request.raw);
    if (cfg.ignoreIPs.includes(ip)) return;

    const processingTimeMs = Math.round(reply.getResponseTime());

    const payload = {
      projectId:        cfg.projectId,
      method:           request.method,
      url:              request.url,
      ip,
      queryParams:      request.query  || {},
      body:             scrubBody(request.body, cfg.maxBodySize),
      headers: {
        userAgent:   request.headers['user-agent']   || '',
        contentType: request.headers['content-type'] || '',
        referer:     request.headers['referer']      || '',
      },
      responseCode:     reply.statusCode,
      processingTimeMs,
    };

    send(client, payload, cfg);
  });
}

module.exports = { sentinelFastify };
