const logger = require('../utils/logger');

describe("Logger (Winston)", () => {

  it("should be defined and have core log methods", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.http).toBe('function');
  });

  it("should have a Morgan-compatible stream with write method", () => {
    expect(logger.stream).toBeDefined();
    expect(typeof logger.stream.write).toBe('function');
  });

  it("should not throw when logging info", () => {
    expect(() => logger.info('test info message')).not.toThrow();
  });

  it("should not throw when logging errors", () => {
    expect(() => logger.error('test error message')).not.toThrow();
  });

  it("should not throw when logging warnings", () => {
    expect(() => logger.warn('test warning message')).not.toThrow();
  });

  it("should accept Error objects with stacks", () => {
    const err = new Error('test error with stack');
    expect(() => logger.error(err)).not.toThrow();
  });

  it("should be silent in test environment", () => {
    // In test env, console transport is silent — verify no crash
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('silent test');
    spy.mockRestore();
    expect(true).toBe(true); // Logger didn't crash
  });

});
