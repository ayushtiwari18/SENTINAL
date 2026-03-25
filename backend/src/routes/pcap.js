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

// Multer — save to /tmp/uploads, accept only .pcap
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
 *   2. POST filepath to PCAP service  → get { analyzed, attacks_found, attacks[] }
 *   3. For each attack: save SystemLog + AttackEvent to MongoDB
 *   4. Emit attack:new for each confirmed attack (dashboard picks it up live)
 *   5. Delete tmp file
 *   6. Return summary
 */
router.post('/upload', upload.single('pcap'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No .pcap file uploaded. Use field name "pcap".' });
  }

  const tmpPath = req.file.path;

  try {
    // Step 2 — ask PCAP service to process the file
    const pcapResp = await axios.post(`${PCAP_SERVICE_URL}/process`, {
      filepath:  tmpPath,
      projectId: req.body.projectId || 'pcap-upload',
    }, { timeout: 120_000 }); // 2 min timeout for large files

    const { analyzed, attacks_found, attacks, skipped } = pcapResp.data;

    // Step 3 + 4 — persist each attack, emit socket event
    const savedAttacks = [];

    for (const a of attacks) {
      try {
        // Save a minimal SystemLog so AttackEvent has a requestId
        const log = await SystemLog.create({
          projectId:    req.body.projectId || 'pcap-upload',
          method:       a.method  || 'GET',
          url:          a.url     || '/',
          ip:           a.ip      || '0.0.0.0',
          responseCode: a.responseCode ?? null,
          queryParams:  a.queryParams  || {},
          body:         a.body         || {},
          headers:      a.headers      || {},
        });

        // Normalise attackType — Detection Engine may return values not in enum
        const VALID_TYPES = ['sqli','xss','traversal','command_injection','ssrf','lfi_rfi','brute_force','hpp','xxe','webshell'];
        const attackType  = VALID_TYPES.includes(a.attackType) ? a.attackType : 'unknown';

        // Normalise status from responseCode
        let status = 'attempt';
        if (a.responseCode) {
          status = (a.responseCode >= 200 && a.responseCode < 400) ? 'successful' : 'blocked';
        }

        const attack = await AttackEvent.create({
          requestId:   log._id,
          ip:          a.ip          || '0.0.0.0',
          attackType,
          severity:    a.severity    || 'medium',
          status,
          detectedBy:  a.detectedBy  || 'rule',
          confidence:  a.confidence  ?? 1.0,
          payload:     a.payload     || '',
          explanation: a.explanation || '',
          responseCode: a.responseCode ?? null,
        });

        savedAttacks.push(attack);

        // Emit to dashboard — same event the live feed listens to
        emitter.emit('attack:new', {
          id:          attack._id,
          ip:          attack.ip,
          attackType:  attack.attackType,
          severity:    attack.severity,
          status:      attack.status,
          detectedBy:  attack.detectedBy,
          confidence:  attack.confidence,
          url:         log.url,
          timestamp:   attack.timestamp,
          source:      'pcap',
        });

      } catch (saveErr) {
        // Don't abort — log and continue
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
    // Step 5 — always delete the tmp file
    fs.unlink(tmpPath, () => {});
  }
});

module.exports = router;
