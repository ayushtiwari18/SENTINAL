const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const SystemLog = require('../models/SystemLog');
const AttackEvent = require('../models/AttackEvent');
const Alert = require('../models/Alert');
const ServiceStatus = require('../models/ServiceStatus');

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
  await SystemLog.deleteMany({});
  await AttackEvent.deleteMany({});
  await Alert.deleteMany({});
  await ServiceStatus.deleteMany({});
});

// ─── SystemLog Tests ───────────────────────────────────────────
describe("SystemLog Model", () => {

  it("should create a valid SystemLog", async () => {
    const log = await SystemLog.create({
      projectId: 'proj_test123',
      method: 'GET',
      url: '/api/users',
      ip: '192.168.1.1'
    });
    expect(log._id).toBeDefined();
    expect(log.projectId).toBe('proj_test123');
    expect(log.method).toBe('GET');
  });

  it("should reject SystemLog without required fields", async () => {
    await expect(
      SystemLog.create({ method: 'GET' })
    ).rejects.toThrow();
  });

  it("should reject invalid HTTP method", async () => {
    await expect(
      SystemLog.create({
        projectId: 'proj_test',
        method: 'INVALID',
        url: '/test',
        ip: '1.1.1.1'
      })
    ).rejects.toThrow();
  });

});

// ─── AttackEvent Tests ─────────────────────────────────────────
describe("AttackEvent Model", () => {

  it("should create a valid AttackEvent", async () => {
    const fakeRequestId = new mongoose.Types.ObjectId();
    const attack = await AttackEvent.create({
      requestId: fakeRequestId,
      ip: '10.0.0.1',
      attackType: 'sqli',
      severity: 'high',
      status: 'attempt',
      detectedBy: 'rule'
    });
    expect(attack._id).toBeDefined();
    expect(attack.attackType).toBe('sqli');
    expect(attack.confidence).toBe(1.0);
  });

  it("should reject AttackEvent with invalid attackType", async () => {
    const fakeRequestId = new mongoose.Types.ObjectId();
    await expect(
      AttackEvent.create({
        requestId: fakeRequestId,
        ip: '10.0.0.1',
        attackType: 'nuclear_bomb',
        severity: 'high',
        status: 'attempt',
        detectedBy: 'rule'
      })
    ).rejects.toThrow();
  });

  it("should reject confidence outside 0-1", async () => {
    const fakeRequestId = new mongoose.Types.ObjectId();
    await expect(
      AttackEvent.create({
        requestId: fakeRequestId,
        ip: '10.0.0.1',
        attackType: 'xss',
        severity: 'low',
        status: 'attempt',
        detectedBy: 'ml',
        confidence: 1.5
      })
    ).rejects.toThrow();
  });

});

// ─── Alert Tests ───────────────────────────────────────────────
describe("Alert Model", () => {

  it("should create a valid Alert", async () => {
    const fakeAttackId = new mongoose.Types.ObjectId();
    const alert = await Alert.create({
      attackId: fakeAttackId,
      title: 'SQLi Detected',
      message: 'SQL injection attempt from 10.0.0.1',
      severity: 'high',
      type: 'attack_detected'
    });
    expect(alert._id).toBeDefined();
    expect(alert.isRead).toBe(false);
  });

  it("should reject Alert without required fields", async () => {
    await expect(
      Alert.create({ title: 'Test' })
    ).rejects.toThrow();
  });

});

// ─── ServiceStatus Tests ───────────────────────────────────────
describe("ServiceStatus Model", () => {

  it("should create a valid ServiceStatus", async () => {
    const svc = await ServiceStatus.create({
      serviceName: 'detection-engine',
      status: 'online',
      responseTimeMs: 42
    });
    expect(svc._id).toBeDefined();
    expect(svc.status).toBe('online');
  });

  it("should reject duplicate serviceName", async () => {
    await ServiceStatus.create({ serviceName: 'gateway', status: 'online' });
    await expect(
      ServiceStatus.create({ serviceName: 'gateway', status: 'offline' })
    ).rejects.toThrow();
  });

  it("should reject invalid status value", async () => {
    await expect(
      ServiceStatus.create({ serviceName: 'pcap-processor', status: 'sleeping' })
    ).rejects.toThrow();
  });

});
