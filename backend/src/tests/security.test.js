const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const key in cols) await cols[key].deleteMany({});
});

// ─── Helmet Headers ────────────────────────────────────────────
describe("Security Headers (Helmet)", () => {

  it("should set X-Content-Type-Options header", async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it("should set X-Frame-Options header", async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it("should set X-DNS-Prefetch-Control header", async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
  });

});

// ─── Joi Validation — Log Ingest ──────────────────────────────
describe("Joi Validation — POST /api/logs/ingest", () => {

  it("should accept valid log payload", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_abc', method: 'GET', url: '/test', ip: '1.1.1.1'
    });
    expect(res.status).toBe(201);
  });

  it("should reject missing projectId", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      method: 'GET', url: '/test', ip: '1.1.1.1'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject invalid HTTP method", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_x', method: 'HACK', url: '/test', ip: '1.1.1.1'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject invalid responseCode", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_x', method: 'GET', url: '/test',
      ip: '1.1.1.1', responseCode: 999
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

});

// ─── Joi Validation — Attack Report ───────────────────────────
describe("Joi Validation — POST /api/attacks/report", () => {

  let validRequestId;

  beforeEach(async () => {
    const logRes = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_test', method: 'POST', url: '/login', ip: '10.0.0.1'
    });
    validRequestId = logRes.body.data.id;
  });

  it("should accept valid attack payload", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      requestId: validRequestId, ip: '10.0.0.1',
      attackType: 'sqli', severity: 'high',
      status: 'attempt', detectedBy: 'rule'
    });
    expect(res.status).toBe(201);
  });

  it("should reject invalid attackType", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      requestId: validRequestId, ip: '10.0.0.1',
      attackType: 'nuclear', severity: 'high',
      status: 'attempt', detectedBy: 'rule'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject confidence > 1", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      requestId: validRequestId, ip: '10.0.0.1',
      attackType: 'xss', severity: 'low',
      status: 'attempt', detectedBy: 'ml',
      confidence: 1.5
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject non-hex requestId", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      requestId: 'not-valid-id', ip: '10.0.0.1',
      attackType: 'xss', severity: 'low',
      status: 'attempt', detectedBy: 'rule'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

});
