const axios = require('axios');
const { withRetry } = require('../utils/retry');
const logger = require('../utils/logger');

const DETECTION_ENGINE_URL = process.env.DETECTION_ENGINE_URL
  || 'http://localhost:8002';
const TIMEOUT_MS = 5000;

let circuitOpen = false;
let circuitOpenedAt = null;
const CIRCUIT_RESET_MS = 30000;

const isCircuitOpen = () => {
  if (!circuitOpen) return false;
  if (Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
    circuitOpen = false;
    circuitOpenedAt = null;
    logger.info('[DETECTION] Circuit breaker reset — retrying detection engine');
    return false;
  }
  return true;
};

const openCircuit = () => {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
  logger.warn('[DETECTION] Circuit breaker OPEN — detection engine unreachable');
};

const analyze = async (logData) => {
  if (isCircuitOpen()) {
    logger.warn('[DETECTION] Circuit open — skipping detection for this request');
    return null;
  }

  try {
    const result = await withRetry(async () => {
      const response = await axios.post(
        `${DETECTION_ENGINE_URL}/analyze`,
        {
          logId:       logData._id,
          projectId:   logData.projectId,
          method:      logData.method,
          url:         logData.url,
          ip:          logData.ip,
          queryParams: logData.queryParams,
          body:        logData.body,
          headers:     logData.headers
        },
        { timeout: TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    }, 3, 200);

    logger.info(`[DETECTION] Analysis complete for log ${logData._id}`);
    return result;

  } catch (err) {
    openCircuit();
    logger.error(`[DETECTION] Failed after retries: ${err.message}`);
    return null;
  }
};

const _resetCircuit = () => {
  circuitOpen = false;
  circuitOpenedAt = null;
};

module.exports = { analyze, _resetCircuit };
