const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const emitter = require('../utils/eventEmitter');
const broadcastService = require('../sockets/broadcastService');
const { EVENTS } = require('../sockets/broadcastService');

let mongod, httpServer, ioServer, clientSocket;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  httpServer = createServer();
  ioServer = new Server(httpServer, { cors: { origin: '*' } });
  broadcastService.init(ioServer);

  await new Promise(resolve => httpServer.listen(0, resolve));
  const port = httpServer.address().port;

  clientSocket = new Client(`http://localhost:${port}`);
  await new Promise(resolve => clientSocket.on('connect', resolve));
});

afterAll(async () => {
  clientSocket.disconnect();
  ioServer.close();
  httpServer.close();
  await mongoose.disconnect();
  await mongod.stop();
});

// ─── Event Emitter Tests ────────────────────────────────────────
describe("eventEmitter (internal bus)", () => {

  it("should emit and receive a custom event", (done) => {
    emitter.once('test:event', (data) => {
      expect(data.msg).toBe('hello');
      done();
    });
    emitter.emit('test:event', { msg: 'hello' });
  });

  it("should support multiple listeners on same event", (done) => {
    let count = 0;
    const check = () => { count++; if (count === 2) done(); };
    emitter.once('test:multi', check);
    emitter.once('test:multi', check);
    emitter.emit('test:multi', {});
  });

});

// ─── Broadcast Service Tests ────────────────────────────────────
describe("broadcastService", () => {

  it("should broadcast attack:new to connected client", (done) => {
    clientSocket.once(EVENTS.ATTACK_NEW, (payload) => {
      expect(payload.event).toBe(EVENTS.ATTACK_NEW);
      expect(payload.data.attackType).toBe('sqli');
      done();
    });

    emitter.emit(EVENTS.ATTACK_NEW, {
      id: 'test123',
      ip: '10.0.0.1',
      attackType: 'sqli',
      severity: 'high'
    });
  });

  it("should broadcast alert:new to connected client", (done) => {
    clientSocket.once(EVENTS.ALERT_NEW, (payload) => {
      expect(payload.event).toBe(EVENTS.ALERT_NEW);
      expect(payload.data.severity).toBe('critical');
      done();
    });

    emitter.emit(EVENTS.ALERT_NEW, {
      id: 'alert456',
      title: 'XSS Detected',
      severity: 'critical',
      type: 'attack_detected'
    });
  });

  it("should include timestamp in every broadcast", (done) => {
    clientSocket.once(EVENTS.ATTACK_NEW, (payload) => {
      expect(payload.timestamp).toBeDefined();
      expect(new Date(payload.timestamp).toString()).not.toBe('Invalid Date');
      done();
    });

    emitter.emit(EVENTS.ATTACK_NEW, {
      attackType: 'xss', ip: '1.1.1.1', severity: 'low'
    });
  });

});
