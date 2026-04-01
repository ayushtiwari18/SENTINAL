'use strict';
/**
 * sentinel-middleware unit tests
 */
const { resolveConfig, scrubBody, extractIP } = require('../src/config');

describe('resolveConfig', () => {
  it('throws if projectId is missing', () => {
    delete process.env.SENTINAL_PROJECT_ID;
    expect(() => resolveConfig({ gatewayUrl: 'http://localhost:3000' }))
      .toThrow('projectId is required');
  });

  it('reads projectId from env', () => {
    process.env.SENTINAL_PROJECT_ID = 'env-project';
    const cfg = resolveConfig();
    expect(cfg.projectId).toBe('env-project');
    delete process.env.SENTINAL_PROJECT_ID;
  });

  it('uses default gatewayUrl', () => {
    const cfg = resolveConfig({ projectId: 'test' });
    expect(cfg.gatewayUrl).toBe('http://localhost:3000');
  });

  it('throws on invalid sampleRate', () => {
    expect(() => resolveConfig({ projectId: 'test', sampleRate: 1.5 }))
      .toThrow('sampleRate must be between 0.0 and 1.0');
  });

  it('applies all defaults', () => {
    const cfg = resolveConfig({ projectId: 'test' });
    expect(cfg.maxBodySize).toBe(4096);
    expect(cfg.timeout).toBe(3000);
    expect(cfg.debug).toBe(false);
  });
});

describe('scrubBody', () => {
  it('redacts password field', () => {
    const out = scrubBody({ username: 'alice', password: 'secret123' }, 4096);
    expect(out.username).toBe('alice');
    expect(out.password).toBe('[REDACTED]');
  });

  it('redacts token field', () => {
    const out = scrubBody({ data: 'ok', token: 'abc123' }, 4096);
    expect(out.token).toBe('[REDACTED]');
  });

  it('truncates large body', () => {
    const large = { data: 'x'.repeat(5000) };
    const out = scrubBody(large, 100);
    expect(out._truncated).toBe(true);
  });

  it('returns empty object for null body', () => {
    expect(scrubBody(null, 4096)).toEqual({});
  });

  it('returns empty object for non-object body', () => {
    expect(scrubBody('string', 4096)).toEqual({});
  });
});

describe('extractIP', () => {
  it('extracts from X-Forwarded-For', () => {
    const req = { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } };
    expect(extractIP(req)).toBe('1.2.3.4');
  });

  it('falls back to req.ip', () => {
    const req = { headers: {}, ip: '9.9.9.9' };
    expect(extractIP(req)).toBe('9.9.9.9');
  });

  it('falls back to 0.0.0.0 if nothing found', () => {
    const req = { headers: {} };
    expect(extractIP(req)).toBe('0.0.0.0');
  });
});

describe('Express middleware integration', () => {
  let sentinel;
  beforeAll(() => {
    sentinel = require('../src/adapters/express').sentinel;
  });

  it('calls next()', (done) => {
    const mw = sentinel({ projectId: 'test', gatewayUrl: 'http://localhost:9999' });
    const req = {
      method: 'GET',
      url: '/',
      originalUrl: '/',
      path: '/',
      query: {},
      body: {},
      headers: {},
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 200,
      on: (event, fn) => { if (event === 'finish') fn(); },
    };
    mw(req, res, done);
  });

  it('skips ignored route', (done) => {
    const mw = sentinel({ projectId: 'test', gatewayUrl: 'http://localhost:9999', ignoreRoutes: ['/health'] });
    const req = { path: '/health', method: 'GET', url: '/health', query: {}, headers: {}, ip: '1.1.1.1' };
    const res = { statusCode: 200, on: jest.fn() };
    mw(req, res, () => {
      expect(res.on).not.toHaveBeenCalled();
      done();
    });
  });

  it('skips ignored IP', (done) => {
    const mw = sentinel({ projectId: 'test', gatewayUrl: 'http://localhost:9999', ignoreIPs: ['127.0.0.1'] });
    const req = { path: '/', method: 'GET', url: '/', query: {}, headers: {}, ip: '127.0.0.1' };
    const res = { statusCode: 200, on: jest.fn() };
    mw(req, res, () => {
      expect(res.on).not.toHaveBeenCalled();
      done();
    });
  });
});
