const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('../../server');   // ← destructure


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

// ─── Log Ingestion ─────────────────────────────────────────────
describe("POST /api/logs/ingest", () => {

  const validLog = {
    projectId: 'proj_abc123',
    method: 'GET',
    url: '/api/users',
    ip: '192.168.1.1'
  };

  it("should ingest a valid log and return 201", async () => {
    const res = await request(app).post('/api/logs/ingest').send(validLog);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it("should reject missing projectId with 400", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      method: 'GET', url: '/test', ip: '1.1.1.1'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject missing ip with 400", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_x', method: 'POST', url: '/test'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject invalid HTTP method", async () => {
    const res = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_x', method: 'HACK', url: '/test', ip: '1.1.1.1'
    });
    expect(res.status).toBe(500); // Mongoose enum validation hits global handler
    expect(res.body.success).toBe(false);
  });

});

// ─── Attack Reporting ──────────────────────────────────────────
describe("POST /api/attacks/report", () => {

  let validRequestId;

  beforeEach(async () => {
    const logRes = await request(app).post('/api/logs/ingest').send({
      projectId: 'proj_test', method: 'POST', url: '/login', ip: '10.0.0.1'
    });
    validRequestId = logRes.body.data.id;
  });

  const baseAttack = () => ({
    requestId: validRequestId,
    ip: '10.0.0.1',
    attackType: 'sqli',
    severity: 'high',
    status: 'attempt',
    detectedBy: 'rule',
    confidence: 0.95,
    payload: "' OR 1=1--"
  });

  it("should report a valid attack and return 201", async () => {
    const res = await request(app).post('/api/attacks/report').send(baseAttack());
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
  });

  it("should reject invalid attackType", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      ...baseAttack(), attackType: 'nuclear'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject invalid ObjectId for requestId", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      ...baseAttack(), requestId: 'not-an-objectid'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it("should reject missing required fields", async () => {
    const res = await request(app).post('/api/attacks/report').send({
      ip: '10.0.0.1', attackType: 'xss'
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

});

// ─── Stats ─────────────────────────────────────────────────────
describe("GET /api/stats", () => {

  it("should return stats with zero counts on empty DB", async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalLogs).toBe(0);
    expect(res.body.data.totalAttacks).toBe(0);
    expect(res.body.data.totalAlerts).toBe(0);
  });

  it("should reflect ingested logs in stats", async () => {
    await request(app).post('/api/logs/ingest').send({
      projectId: 'p1', method: 'GET', url: '/test', ip: '1.1.1.1'
    });
    const res = await request(app).get('/api/stats');
    expect(res.body.data.totalLogs).toBe(1);
  });

});
