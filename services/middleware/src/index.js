'use strict';
/**
 * sentinel-middleware — main entry point
 * Exports: sentinel (Express), sentinelFastify (Fastify)
 */
const { sentinel }        = require('./adapters/express');
const { sentinelFastify } = require('./adapters/fastify');

module.exports = { sentinel, sentinelFastify };
