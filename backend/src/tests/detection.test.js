const { withRetry } = require('../utils/retry');
const detectionConnector = require('../services/detectionConnector');

// ─── Retry Utility Tests ───────────────────────────────────────
describe("withRetry utility", () => {

  it("should resolve immediately on first success", async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed on second attempt", async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, 3, 10);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should throw after exhausting all attempts", async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, 3, 10)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should respect attempt count of 1 — no retries", async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, 1, 10)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

});

// ─── Detection Connector Tests ─────────────────────────────────
describe("detectionConnector.analyze", () => {

  const fakeLog = {
    _id: '507f1f77bcf86cd799439011',
    projectId: 'proj_test',
    method: 'GET',
    url: '/api/users?id=1 OR 1=1',
    ip: '10.0.0.1',
    queryParams: { id: "1 OR 1=1" },
    body: {},
    headers: {}
  };

  beforeEach(() => {
    detectionConnector._resetCircuit();
    jest.clearAllMocks();
  });

  it("should return null when detection engine is unreachable", async () => {
    // Detection engine is not running in test — should fail gracefully
    const result = await detectionConnector.analyze(fakeLog);
    expect(result).toBeNull();
  });

  it("should return null (not throw) on network error", async () => {
    await expect(
      detectionConnector.analyze(fakeLog)
    ).resolves.toBeNull();
  });

  it("should open circuit after failed attempts", async () => {
    // First call exhausts retries and opens circuit
    await detectionConnector.analyze(fakeLog);
    // Second call should skip immediately due to open circuit
    const start = Date.now();
    await detectionConnector.analyze(fakeLog);
    const elapsed = Date.now() - start;
    // Should return almost instantly (no retry delays)
    expect(elapsed).toBeLessThan(500);
  });

});
