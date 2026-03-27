const express  = require('express');
const multer   = require('multer');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const router   = express.Router();

const SystemLog   = require('../models/SystemLog');
const AttackEvent = require('../models/AttackEvent');
const emitter     = require('../utils/eventEmitter');
const logger      = require('../utils/logger');

// ── Service URL ────────────────────────────────────────────────────────
// Supports both new centralized PCAP_URL and old PCAP_SERVICE_URL (backward compat)
const PCAP_SERVICE_URL =
  process.env.PCAP_URL ||
  process.env.PCAP_SERVICE_URL ||
  'http://localhost:8003';

// ── Attack type normaliser ──────────────────────────────────────────────
const ATTACK_TYPE_MAP = {
  'SQL Injection':            'sqli',
  'XSS':                      'xss',
  'Path Traversal':           'traversal',
  'Command Injection':        'command_injection',
  'SSRF':                     'ssrf',
  'LFI/RFI':                  'lfi_rfi',
  'Brute Force':              'brute_force',
  'HTTP Parameter Pollution': 'hpp',
  'XXE':                      'xxe',
  'Webshell':                 'webshell',
  'Typosquatting':            'unknown',
  'SQL_INJECTION':            'sqli',
  'PORT_SCAN':                'recon',
  'SYN_FLOOD':                'ddos',
  'DDOS':                     'ddos',
  'ICMP_FLOOD':               'ddos',
  'DNS_AMPLIFICATION':        'ddos',
  'BRUTE_FORCE':              'brute_force',
};

const normaliseSeverity = (s) => {
  if (!s) return 'medium';
  const map = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
  return map[s.toUpperCase()] || s.toLowerCase();
};

// ── Multer ───────────────────────────────────────────────────────────────────────────
const upload = multer({
  dest: path.join('/tmp', 'sentinal-uploads'),
  limits: { fileSize: parseInt(process.env.MAX_PCAP_SIZE_MB || '500') * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.originalname.endsWith('.pcap')
             || file.originalname.endsWith('.pcapng')
             || file.mimetype === 'application/octet-stream';
    ok ? cb(null, true) : cb(new Error('Only .pcap / .pcapng files are accepted'), false);
  },
});

/**
 * POST /api/pcap/upload
 * Body: multipart/form-data  field: "pcap"  (the capture file)
 */
router.post('/upload', upload.single('pcap'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No .pcap file uploaded. Use form field name "pcap".',
    });
  }

  const tmpPath = req.file.path;

  try {
    logger.info(`[PCAP] Sending to processor at ${PCAP_SERVICE_URL}: ${tmpPath}`);

    const pcapResp = await axios.post(
      `${PCAP_SERVICE_URL}/process`,
      { filepath: tmpPath, projectId: req.body.projectId || 'pcap-upload' },
      { timeout: 300_000 },
    );

    const {
      total_packets,
      parsed_packets,
      total_flows,
      processing_time_s,
      local_attacks   = [],
      engine_attacks  = [],
      skipped_engine  = 0,
    } = pcapResp.data;

    logger.info(
      `[PCAP] Processor response: packets=${total_packets} flows=${total_flows} ` +
      `local_attacks=${local_attacks.length} engine_attacks=${engine_attacks.length} ` +
      `time=${processing_time_s}s`
    );

    const allAttacks = [];

    for (const a of local_attacks) {
      allAttacks.push({
        source:      'local',
        attackType:  ATTACK_TYPE_MAP[a.attack_type] || 'unknown',
        rawType:     a.attack_type,
        severity:    normaliseSeverity(a.severity),
        ip:          a.src_ip || '0.0.0.0',
        url:         '',
        confidence:  1.0,
        description: a.description || '',
        evidence:    a.evidence    || {},
        explanation: '',
        responseCode: null,
      });
    }

    for (const a of engine_attacks) {
      if (!a.threat_detected) continue;
      allAttacks.push({
        source:      'engine',
        attackType:  ATTACK_TYPE_MAP[a.threat_type] || 'unknown',
        rawType:     a.threat_type || '',
        severity:    normaliseSeverity(a.severity),
        ip:          a.ip          || '0.0.0.0',
        url:         a.url         || '/',
        confidence:  a.confidence  ?? 1.0,
        description: '',
        evidence:    {},
        explanation: a.explanation ? JSON.stringify(a.explanation) : '',
        responseCode: a.responseCode ?? null,
      });
    }

    const savedAttacks = [];
    const projectId = req.body.projectId || 'pcap-upload';

    for (const a of allAttacks) {
      try {
        const log = await SystemLog.create({
          projectId,
          method:       'GET',
          url:          a.url         || '/',
          ip:           a.ip,
          responseCode: a.responseCode,
          queryParams:  {},
          body:         {},
          headers:      {},
        });

        let status = 'attempt';
        if (a.responseCode) {
          status = (a.responseCode >= 200 && a.responseCode < 400) ? 'successful' : 'blocked';
        }

        const attack = await AttackEvent.create({
          requestId:    log._id,
          ip:           a.ip,
          attackType:   a.attackType,
          severity:     a.severity,
          status,
          detectedBy:   'rule',
          confidence:   a.confidence,
          payload:      a.url || a.description || '',
          explanation:  a.explanation || a.description || '',
          mitigationSuggestion: '',
          responseCode: a.responseCode,
        });

        savedAttacks.push(attack);

        emitter.emit('attack:new', {
          id:         attack._id,
          ip:         attack.ip,
          attackType: attack.attackType,
          severity:   attack.severity,
          status:     attack.status,
          detectedBy: attack.detectedBy,
          confidence: attack.confidence,
          url:        log.url,
          timestamp:  attack.createdAt,
          source:     'pcap',
        });

      } catch (saveErr) {
        logger.error(`[PCAP] Failed to save attack: ${saveErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `PCAP processed. ${savedAttacks.length} attack(s) saved.`,
      data: {
        total_packets,
        parsed_packets,
        total_flows,
        processing_time_s,
        local_attacks_found:  local_attacks.length,
        engine_attacks_found: engine_attacks.length,
        attacks_saved:        savedAttacks.length,
        skipped_engine,
      },
    });

  } catch (err) {
    logger.error(`[PCAP] Processing failed: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.detail || err.message,
    });

  } finally {
    fs.unlink(tmpPath, () => {});
  }
});

module.exports = router;
