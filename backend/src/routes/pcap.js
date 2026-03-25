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

const PCAP_SERVICE_URL = process.env.PCAP_SERVICE_URL || 'http://localhost:8001';

// Same map as logService.js — single source of truth for threat_type → enum
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
};

// Multer — save to /tmp/sentinal-uploads, accept only .pcap
const upload = multer({
  dest: path.join('/tmp', 'sentinal-uploads'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.pcap') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only .pcap files are accepted'), false);
    }
  },
});

/**
 * POST /api/pcap/upload
 * Body: multipart/form-data  field: "pcap" (the .pcap file)
 *
 * Flow:
 *   1. multer saves file to /tmp/sentinal-uploads/<uuid>
 *   2. POST filepath to PCAP service → { analyzed, attacks_found, attacks[] }
 *      Each attack in attacks[] is the raw Detection Engine response:
 *        { threat_detected, threat_type, severity, confidence, status, explanation, ... }
 *   3. For each where threat_detected === true: save SystemLog + AttackEvent
 *   4. Emit attack:new per confirmed attack (dashboard live feed picks it up)
 *   5. Delete tmp file
 *   6. Return summary
 */
router.post('/upload', upload.single('pcap'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No .pcap file uploaded. Use field name "pcap".' });
  }

  const tmpPath = req.file.path;

  try {
    // Step 2 — send to PCAP service
    const pcapResp = await axios.post(`${PCAP_SERVICE_URL}/process`, {
      filepath:  tmpPath,
      projectId: req.body.projectId || 'pcap-upload',
    }, { timeout: 120_000 });

    const { analyzed, attacks_found, attacks, skipped } = pcapResp.data;

    // Step 3 + 4 — persist and emit each confirmed attack
    const savedAttacks = [];

    for (const a of attacks) {
      // Detection Engine uses threat_detected (not isAttack) — match logService.js
      if (!a.threat_detected) continue;

      try {
        // Save SystemLog so AttackEvent has a valid requestId FK
        const log = await SystemLog.create({
          projectId:    req.body.projectId || 'pcap-upload',
          method:       a.method      || 'GET',
          url:          a.url         || '/',
          ip:           a.ip          || '0.0.0.0',
          responseCode: a.responseCode ?? null,
          queryParams:  a.queryParams  || {},
          body:         a.body         || {},
          headers:      a.headers      || {},
        });

        // Map threat_type string → AttackEvent enum (same as logService.js)
        const attackType = ATTACK_TYPE_MAP[a.threat_type] || 'unknown';

        // Derive status from responseCode
        let status = 'attempt';
        if (a.responseCode) {
          status = (a.responseCode >= 200 && a.responseCode < 400) ? 'successful' : 'blocked';
        }

        const attack = await AttackEvent.create({
          requestId:    log._id,
          ip:           a.ip          || '0.0.0.0',
          attackType,
          severity:     a.severity    || 'medium',
          status,
          detectedBy:   'rule',           // PCAP path always goes through rule engine
          confidence:   a.confidence  ?? 1.0,
          payload:      a.url          || '',
          explanation:  a.explanation ? JSON.stringify(a.explanation) : '',
          mitigationSuggestion: a.explanation?.recommended_action || '',
          responseCode: a.responseCode ?? null,
        });

        savedAttacks.push(attack);

        // Emit — dashboard live feed receives this immediately
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
      message: `PCAP processed. ${savedAttacks.length} attacks saved.`,
      data: {
        analyzed,
        attacks_found,
        attacks_saved: savedAttacks.length,
        skipped,
      },
    });

  } catch (err) {
    logger.error(`[PCAP] Processing failed: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: err.response?.data?.detail || err.message,
    });

  } finally {
    // Always delete the tmp file regardless of outcome
    fs.unlink(tmpPath, () => {});
  }
});

module.exports = router;
