const axios = require('axios');
const { withRetry } = require('../utils/retry');

const DETECTION_ENGINE_URL = process.env.DETECTION_ENGINE_URL
  || 'http://localhost:8002';

const TIMEOUT_MS = 5000;  // 5 seconds max

// Simple circuit breaker state
let circuitOpen = false;
let circuitOpenedAt = null;
const CIRCUIT_RESET_MS = 30000; // 30 seconds

const isCircuitOpen = () => {
  if (!circuitOpen) return false;
  // Auto-reset after 30 seconds
  if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
    circuitOpen = false;
    circuitOpenedAt = null;
    console.log('[DETECTION] Circuit breaker reset — retrying detection engine');
    return false;
  }
  return true;
};

const openCircuit = () => {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
  console.warn('[DETECTION] Circuit breaker OPEN — detection engine unreachable');
};

/**
 * Send a log to the detection engine for analysis.
 * Returns the detection result or null if unavailable.
 * NEVER throws — caller must always succeed.
 */
const analyze = async (logData) => {
  if (isCircuitOpen()) {
    console.warn('[DETECTION] Circuit open — skipping detection for this request');
    return null;
  }

  try {
    const result = await withRetry(async () => {
      const response = await axios.post(
        `${DETECTION_ENGINE_URL}/analyze`,
        {
          logId:      logData._id,
          projectId:  logData.projectId,
          method:     logData.method,
          url:        logData.url,
          ip:         logData.ip,
          queryParams: logData.queryParams,
          body:       logData.body,
          headers:    logData.headers
        },
        {
          timeout: TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return response.data;
    }, 3, 200);

    console.log(`[DETECTION] Analysis complete for log ${logData._id}`);
    return result;

  } catch (err) {
    // Open circuit after exhausting retries
    openCircuit();
    console.error(`[DETECTION] Failed after retries: ${err.message}`);
    return null;
  }
};

// Export for testing
const _resetCircuit = () => {
  circuitOpen = false;
  circuitOpenedAt = null;
};

module.exports = { analyze, _resetCircuit };
