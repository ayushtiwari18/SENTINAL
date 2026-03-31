/**
 * Nexus Trigger Route
 * POST /api/Nexus/trigger
 *
 * Creates a real SystemLog + AttackEvent in MongoDB, then triggers
 * the Nexus enforcement pipeline. Does NOT require the Detection
 * Engine to be running. Use this for demos and testing.
 *
 * Body: { ip, attackType, severity, confidence, status }
 */
const express       = require('express');
const router        = express.Router();
const SystemLog     = require('../models/SystemLog');
const attackService = require('../services/attackService');
const logger        = require('../utils/logger');

const VALID_SEVERITIES   = ['low', 'medium', 'high', 'critical'];
const VALID_ATTACK_TYPES = [
  'sqli', 'xss', 'traversal', 'command_injection',
  'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe', 'webshell', 'unknown'
];

const TYPE_DESCRIPTIONS = {
  sqli:              'SQL Injection — attacker injected malicious SQL into a query parameter to manipulate the database.',
  xss:               'Cross-Site Scripting (XSS) — attacker injected a client-side script into the request to execute in a victim browser.',
  traversal:         'Path Traversal — attacker used "../" sequences to read files outside the web root.',
  command_injection: 'Command Injection — attacker embedded OS commands in user input to execute arbitrary code on the server.',
  ssrf:              'Server-Side Request Forgery (SSRF) — attacker forced the server to make internal HTTP requests to unauthorized destinations.',
  lfi_rfi:           'Local/Remote File Inclusion — attacker included arbitrary files to leak source code or execute remote payloads.',
  brute_force:       'Brute Force / Credential Stuffing — attacker repeatedly submitted login attempts to guess valid credentials.',
  hpp:               'HTTP Parameter Pollution — attacker injected duplicate parameters to bypass input validation or cause unexpected behavior.',
  xxe:               'XML External Entity (XXE) — attacker embedded a malicious external entity in an XML payload to read files or trigger SSRF.',
  webshell:          'Webshell Upload — attacker attempted to upload or access a backdoor script to gain persistent server access.',
  unknown:           'Unknown Attack Pattern — anomalous request detected that does not match any known attack signature.',
};

const IMPACT_MAP = {
  critical: 'Full system compromise, data exfiltration, or service disruption is possible if not blocked immediately.',
  high:     'Significant risk of unauthorized data access or privilege escalation.',
  medium:   'Partial information disclosure or degraded service integrity.',
  low:      'Limited impact; may be reconnaissance or automated scanner activity.',
};

const ACTION_MAP = {
  sqli:              'Block the IP, sanitize all query parameters, enforce parameterized queries across the codebase.',
  xss:               'Block the IP, enforce strict Content-Security-Policy headers, sanitize all user-controlled output.',
  traversal:         'Block the IP, restrict filesystem access to the web root, validate all file path inputs.',
  command_injection: 'Block the IP immediately, audit all shell-calling code, switch to safe APIs.',
  ssrf:              'Block the IP, enforce an outbound allowlist, disable unused internal metadata endpoints.',
  lfi_rfi:           'Block the IP, disable remote file inclusion in server config, validate all include paths.',
  brute_force:       'Block the IP, enforce MFA on targeted endpoints, implement exponential backoff on login failures.',
  hpp:               'Block the IP, normalize parameter handling, reject duplicate keys in request validation.',
  xxe:               'Block the IP, disable external entity processing in your XML parser, switch to JSON where possible.',
  webshell:          'Block the IP, scan upload directories for executable files, restrict upload MIME types.',
  unknown:           'Flag for manual review, apply rate limiting to the source IP.',
};

/**
 * Build a structured explanation JSON string for simulated attacks.
 * Matches the schema that parseExplanation() + ForensicsPage AI Analysis panel expect:
 *   { summary, what_happened, potential_impact, recommended_action, rule_triggered, source }
 */
const buildSimulatedExplanation = (attackType, severity) =>
  JSON.stringify({
    summary:            `${severity.toUpperCase()} severity ${attackType.replace(/_/g, ' ')} attack detected`,
    what_happened:      TYPE_DESCRIPTIONS[attackType] || `Simulated ${attackType} attack triggered via Nexus demo route.`,
    potential_impact:   IMPACT_MAP[severity]           || 'Impact depends on the attack type and target surface.',
    recommended_action: ACTION_MAP[attackType]         || 'Nexus will evaluate and enforce policy automatically.',
    rule_triggered:     'DEMO_SIMULATE',
    source:             'static',
  });

// POST /api/Nexus/trigger
router.post('/trigger', async (req, res) => {
  try {
    const {
      ip         = '10.0.0.1',
      attackType = 'sqli',
      severity   = 'critical',
      confidence = 0.97,
      status     = 'successful'
    } = req.body;

    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: `severity must be one of: ${VALID_SEVERITIES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }
    if (!VALID_ATTACK_TYPES.includes(attackType)) {
      return res.status(400).json({
        success: false,
        message: `attackType must be one of: ${VALID_ATTACK_TYPES.join(', ')}`,
        code: 'VALIDATION_ERROR'
      });
    }

    logger.info(`[Nexus-TRIGGER] Simulating ${attackType} from ${ip} (${severity})`);

    // Step 1 — Create a real SystemLog so requestId has a valid ObjectId ref
    const demoLog = await SystemLog.create({
      projectId:    'Nexus-demo',
      method:       'GET',
      url:          `/demo/${attackType}-attack`,
      ip,
      queryParams:  {},
      body:         {},
      headers:      { userAgent: 'Nexus-demo', contentType: '', referer: '' },
      responseCode: 200
    });

    // Step 2 — reportAttack saves AttackEvent + calls Nexus fire-and-forget
    const attack = await attackService.reportAttack({
      requestId:            demoLog._id,
      ip,
      attackType,
      severity,
      status,
      detectedBy:           'rule',
      confidence:           parseFloat(confidence) || 0.97,
      payload:              `/demo/${attackType}-attack`,
      explanation:          buildSimulatedExplanation(attackType, severity),
      mitigationSuggestion: ACTION_MAP[attackType] || 'Nexus will evaluate and enforce policy',
      responseCode:         200
    });

    logger.info(`[Nexus-TRIGGER] AttackEvent created: ${attack._id}`);

    res.status(201).json({
      success: true,
      message: 'Attack simulated — Nexus enforcement triggered',
      data: {
        attackId:  attack._id,
        logId:     demoLog._id,
        ip,
        attackType,
        severity,
        confidence,
        note: 'Check /api/actions/pending and /api/audit in ~2 seconds'
      }
    });
  } catch (err) {
    logger.error(`[Nexus-TRIGGER] Error: ${err.message}`);
    res.status(500).json({
      success: false,
      message: 'Trigger failed',
      code: 'SERVER_ERROR',
      detail: err.message
    });
  }
});

module.exports = router;
