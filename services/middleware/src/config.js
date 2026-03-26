'use strict';
/**
 * Resolves and validates middleware configuration.
 * Falls back to environment variables when options are omitted.
 */

const DEFAULTS = {
  sampleRate:   1.0,
  ignoreRoutes: ['/health', '/healthz', '/metrics', '/favicon.ico'],
  ignoreIPs:    [],
  maxBodySize:  4096,
  timeout:      3000,
  debug:        false,
  onError:      null,
  apiKey:       null,
};

const SENSITIVE_BODY_KEYS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
  'cvv', 'ssn', 'creditcard', 'credit_card', 'authorization',
];

function resolveConfig(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };

  cfg.projectId  = cfg.projectId  || process.env.SENTINAL_PROJECT_ID;
  cfg.gatewayUrl = cfg.gatewayUrl || process.env.SENTINAL_GATEWAY_URL || 'http://localhost:3000';
  cfg.apiKey     = cfg.apiKey     || process.env.SENTINAL_API_KEY     || null;
  cfg.debug      = cfg.debug      || process.env.SENTINAL_DEBUG === 'true';

  const envSample = parseFloat(process.env.SENTINAL_SAMPLE_RATE);
  if (!isNaN(envSample)) cfg.sampleRate = envSample;

  if (!cfg.projectId) {
    throw new Error('[sentinel-middleware] projectId is required. Pass it in config or set SENTINAL_PROJECT_ID env var.');
  }
  if (cfg.sampleRate < 0 || cfg.sampleRate > 1) {
    throw new Error('[sentinel-middleware] sampleRate must be between 0.0 and 1.0');
  }

  return cfg;
}

function scrubBody(body, maxSize) {
  if (!body || typeof body !== 'object') return {};
  try {
    const scrubbed = {};
    for (const [k, v] of Object.entries(body)) {
      if (SENSITIVE_BODY_KEYS.includes(k.toLowerCase())) {
        scrubbed[k] = '[REDACTED]';
      } else {
        scrubbed[k] = v;
      }
    }
    // Truncate to maxBodySize bytes
    const str = JSON.stringify(scrubbed);
    if (str.length > maxSize) {
      return { _truncated: true, _preview: str.slice(0, maxSize) };
    }
    return scrubbed;
  } catch {
    return {};
  }
}

function extractIP(req) {
  const xff = req.headers?.['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

module.exports = { resolveConfig, scrubBody, extractIP, SENSITIVE_BODY_KEYS };
