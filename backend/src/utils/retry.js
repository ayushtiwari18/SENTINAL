/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn        - async function to retry
 * @param {number}   attempts  - max attempts (default 3)
 * @param {number}   delayMs   - initial delay in ms (default 200)
 */
const withRetry = async (fn, attempts = 3, delayMs = 200) => {
  let lastError;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        // Exponential backoff: 200ms, 400ms, 800ms
        await new Promise(res => setTimeout(res, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
};

module.exports = { withRetry };
