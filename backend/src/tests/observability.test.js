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

// ─── Enhanced Stats ────────────────────────────────────────────
describe("GET /api/stats — enhanced", () => {

  it("should return recentAttacks array", async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.recentAttacks)).toBe(true);
  });

  it("should return attacksByType object", async () => {
    const res = await request(app).get('/api/stats');
    expect(typeof res.body.data.attacksByType).toBe('object');
  });

  it("should return attacksBySeverity object", async () => {
    const res = await request(app).get('/api/stats');
    expect(typeof res.body.data.attacksBySeverity).toBe('object');
  });

  it("should reflect attack in recentAttacks after report", async () => {
    const logRes = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_test', method: 'POST', url: '/login', ip: '10.0.0.1'
    });
    await request(app).post('/api/attacks/report').send({
      requestId: logRes.body.data.id,
      ip: '10.0.0.1', attackType: 'sqli',
      severity: 'high', status: 'attempt', detectedBy: 'rule'
    });
    const statsRes = await request(app).get('/api/stats');
    expect(statsRes.body.data.totalAttacks).toBe(1);
    expect(statsRes.body.data.recentAttacks.length).toBe(1);
    expect(statsRes.body.data.recentAttacks[0].attackType).toBe('sqli');
  });

  it("should count attacksByType correctly", async () => {
    const logRes = await request(app).post('/api/logs/ingest').send({
      projectId: 'p', method: 'GET', url: '/x', ip: '1.1.1.1'
    });
    await request(app).post('/api/attacks/report').send({
      requestId: logRes.body.data.id,
      ip: '1.1.1.1', attackType: 'xss',
      severity: 'medium', status: 'attempt', detectedBy: 'rule'
    });
    const statsRes = await request(app).get('/api/stats');
    expect(statsRes.body.data.attacksByType.xss).toBe(1);
  });

});

// ─── Service Status ────────────────────────────────────────────
describe("GET /api/service-status", () => {

  it("should return 200 with success true", async () => {
    const res = await request(app).get('/api/service-status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return services array with 4 entries", async () => {
    const res = await request(app).get('/api/service-status');
    expect(Array.isArray(res.body.data.services)).toBe(true);
    expect(res.body.data.services.length).toBe(4);
  });

  it("should always show gateway as online", async () => {
    const res = await request(app).get('/api/service-status');
    const gateway = res.body.data.services.find(s => s.service === 'gateway');
    expect(gateway).toBeDefined();
    expect(gateway.status).toBe('online');
  });

  it("should show python services as offline in test (not running)", async () => {
    const res = await request(app).get('/api/service-status');
    const detection = res.body.data.services.find(s => s.service === 'detection-engine');
    expect(detection.status).toBe('offline');
  });

  it("should return overall degraded when services are down", async () => {
    const res = await request(app).get('/api/service-status');
    expect(res.body.data.overall).toBe('degraded');
  });

  it("should return checkedAt timestamp", async () => {
    const res = await request(app).get('/api/service-status');
    expect(res.body.data.checkedAt).toBeDefined();
    expect(new Date(res.body.data.checkedAt).toString()).not.toBe('Invalid Date');
  });

});
