'use strict';
/**
 * Handles async fire-and-forget POST to SENTINAL Gateway.
 * Includes in-memory retry queue for when Gateway is temporarily down.
 */
const axios = require('axios');

const RETRY_INTERVAL_MS = 10_000;
const MAX_QUEUE_SIZE    = 500;

let retryQueue    = [];
let retryTimer    = null;

function buildClient(cfg) {
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['X-Sentinel-Key'] = cfg.apiKey;
  return axios.create({
    baseURL: cfg.gatewayUrl,
    timeout: cfg.timeout,
    headers,
  });
}

async function send(client, payload, cfg) {
  try {
    await client.post('/api/logs/ingest', payload);
    if (cfg.debug) {
      console.log(`[sentinel] ✅ ingested ${payload.method} ${payload.url} → ${payload.responseCode}`);
    }
  } catch (err) {
    if (cfg.debug) {
      console.warn(`[sentinel] ⚠️  Gateway unreachable — queuing (queue: ${retryQueue.length + 1})`);
    }
    if (typeof cfg.onError === 'function') cfg.onError(err);
    enqueue(payload, client, cfg);
  }
}

function enqueue(payload, client, cfg) {
  if (retryQueue.length >= MAX_QUEUE_SIZE) {
    // Drop oldest to make room
    retryQueue.shift();
  }
  retryQueue.push({ payload, client, cfg });
  scheduleRetry();
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    if (retryQueue.length === 0) {
      clearInterval(retryTimer);
      retryTimer = null;
      return;
    }
    const batch = [...retryQueue];
    retryQueue = [];
    for (const { payload, client, cfg } of batch) {
      try {
        await client.post('/api/logs/ingest', payload);
        if (cfg.debug) console.log(`[sentinel] 🔁 retry succeeded for ${payload.url}`);
      } catch {
        // Re-queue if still failing
        retryQueue.push({ payload, client, cfg });
      }
    }
    if (retryQueue.length > 0) {
      console.warn(`[sentinel] retry queue still has ${retryQueue.length} pending entries`);
    }
  }, RETRY_INTERVAL_MS);
}

module.exports = { buildClient, send };
