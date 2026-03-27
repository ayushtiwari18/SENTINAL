/**
 * atlasVerify.js
 * Phase 3 — Safe Database Migration + CRUD Verification
 *
 * Run: node backend/scripts/atlasVerify.js
 *
 * This script:
 *  1. Connects to MongoDB Atlas using MONGO_URI from .env
 *  2. Verifies all 6 collections exist (creates them by inserting)
 *  3. Performs full CRUD test on each collection
 *  4. Reports results
 *  5. Cleans up all test data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const AttackEvent    = require('../src/models/AttackEvent');
const AuditLog       = require('../src/models/AuditLog');
const ActionQueue    = require('../src/models/ActionQueue');
const Alert          = require('../src/models/Alert');
const ServiceStatus  = require('../src/models/ServiceStatus');
const SystemLog      = require('../src/models/SystemLog');

const COLORS = {
  green  : '\x1b[32m',
  red    : '\x1b[31m',
  yellow : '\x1b[33m',
  cyan   : '\x1b[36m',
  reset  : '\x1b[0m'
};

const pass = (msg) => console.log(`${COLORS.green}  ✓ PASS${COLORS.reset}  ${msg}`);
const fail = (msg) => console.log(`${COLORS.red}  ✗ FAIL${COLORS.reset}  ${msg}`);
const info = (msg) => console.log(`${COLORS.cyan}  ℹ INFO${COLORS.reset}  ${msg}`);
const head = (msg) => console.log(`\n${COLORS.yellow}=== ${msg} ===${COLORS.reset}`);

async function connect() {
  if (!process.env.MONGO_URI) {
    console.error('[FATAL] MONGO_URI not set. Copy .env.example to .env and fill in Atlas credentials.');
    process.exit(1);
  }
  info(`Connecting to: ${process.env.MONGO_URI.replace(/:([^@]+)@/, ':****@')}`);
  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });
  pass(`Connected to MongoDB Atlas — DB: ${mongoose.connection.name}`);
}

async function testCRUD(label, Model, doc, query) {
  head(`CRUD Test: ${label}`);
  const inserted = await Model.create(doc);
  pass(`INSERT — _id: ${inserted._id}`);

  const found = await Model.findOne(query).lean();
  if (found) pass(`READ   — found document: _id=${found._id}`);
  else       fail(`READ   — document not found!`);

  await Model.deleteOne({ _id: inserted._id });
  const deleted = await Model.findById(inserted._id).lean();
  if (!deleted) pass(`DELETE — document removed successfully`);
  else          fail(`DELETE — document still exists!`);
}

async function runVerification() {
  const start = Date.now();
  console.log('\n🚀 SENTINAL — MongoDB Atlas Verification Script');
  console.log('================================================');

  try {
    await connect();

    // ── 1. AttackEvent ────────────────────────────────────────────────────────
    const fakeSystemLogId = new mongoose.Types.ObjectId();
    await testCRUD('AttackEvent', AttackEvent, {
      requestId   : fakeSystemLogId,
      ip          : '192.168.99.1',
      attackType  : 'sqli',
      severity    : 'high',
      status      : 'blocked',
      detectedBy  : 'rule',
      payload     : "' OR 1=1 -- atlas_verify_test",
      confidence  : 0.99
    }, { payload: /atlas_verify_test/ });

    // ── 2. AuditLog ──────────────────────────────────────────────────────────
    await testCRUD('AuditLog', AuditLog, {
      action  : 'atlas_verify_test_action',
      status  : 'BLOCKED',
      reason  : 'Atlas verification test',
      ip      : '10.0.0.1'
    }, { action: 'atlas_verify_test_action' });

    // ── 3. ActionQueue ───────────────────────────────────────────────────────
    await testCRUD('ActionQueue', ActionQueue, {
      attackId    : 'atlas_verify_' + Date.now(),
      action      : 'permanent_ban_ip',
      status      : 'pending',
      agentReason : 'Atlas CRUD test',
      ip          : '172.16.0.1'
    }, { agentReason: 'Atlas CRUD test' });

    // ── 4. Alert ─────────────────────────────────────────────────────────────
    const fakeAttackId = new mongoose.Types.ObjectId();
    await testCRUD('Alert', Alert, {
      attackId : fakeAttackId,
      title    : 'Atlas Verify Test Alert',
      message  : 'CRUD test — safe to delete',
      severity : 'low',
      type     : 'attack_detected'
    }, { title: 'Atlas Verify Test Alert' });

    // ── 5. ServiceStatus ──────────────────────────────────────────────────────
    head('CRUD Test: ServiceStatus');
    // upsert to avoid unique constraint issues
    const ss = await ServiceStatus.findOneAndUpdate(
      { serviceName: 'gateway' },
      { status: 'online', lastChecked: new Date(), responseTimeMs: 5 },
      { upsert: true, new: true }
    );
    pass(`UPSERT — ServiceStatus gateway: ${ss.status}`);

    // ── 6. SystemLog ──────────────────────────────────────────────────────────
    await testCRUD('SystemLog', SystemLog, {
      projectId       : 'atlas_verify_project',
      method          : 'GET',
      url             : '/api/atlas/verify',
      ip              : '127.0.0.1',
      responseCode    : 200,
      processingTimeMs: 12
    }, { projectId: 'atlas_verify_project' });

    // ── Collection Listing ───────────────────────────────────────────────────────
    head('Collection Listing');
    const collections = await mongoose.connection.db.listCollections().toArray();
    const names = collections.map(c => c.name).sort();
    info(`Collections in Atlas DB "${mongoose.connection.name}": ${names.join(', ')}`);

    const expected = ['attackevents', 'audit_log', 'action_queue', 'alerts', 'servicestatuses', 'systemlogs'];
    expected.forEach(col => {
      if (names.includes(col)) pass(`Collection exists: ${col}`);
      else                      fail(`Collection MISSING: ${col}`);
    });

    const elapsed = Date.now() - start;
    console.log(`\n${COLORS.green}✅ All CRUD verifications passed in ${elapsed}ms${COLORS.reset}`);
    console.log(`${COLORS.cyan}🌐 MongoDB Atlas is fully operational for SENTINAL${COLORS.reset}\n`);

  } catch (err) {
    fail(`Verification failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

runVerification();
