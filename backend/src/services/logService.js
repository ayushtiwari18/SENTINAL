const SystemLog = require('../models/SystemLog');
const detectionConnector = require('./detectionConnector');
const attackService = require('./attackService');
const logger = require('../utils/logger');

const ATTACK_TYPE_MAP = {
  'SQL Injection':              'sqli',
  'XSS':                        'xss',
  'Path Traversal':             'traversal',
  'Command Injection':          'command_injection',
  'SSRF':                       'ssrf',
  'LFI/RFI':                    'lfi_rfi',
  'Brute Force':                'brute_force',
  'HTTP Parameter Pollution':   'hpp',
  'XXE':                        'xxe',
  'Webshell':                   'webshell',
  'Typosquatting':              'unknown'
};


const ingestLog = async (data) => {
  const log = await SystemLog.create({
    projectId: data.projectId,
    method: data.method,
    url: data.url,
    ip: data.ip,
    queryParams: data.queryParams || {},
    body: data.body || {},
    headers: data.headers || {},
    responseCode: data.responseCode || null,
    processingTimeMs: data.processingTimeMs || 0,
  });

  if (process.env.NODE_ENV === "test") return log;

  setImmediate(async () => {
    try {
      const detection = await detectionConnector.analyze(log);
      if (detection && detection.threat_detected) {
        await attackService.reportAttack({
          requestId: log._id,
          ip: log.ip,
          attackType: ATTACK_TYPE_MAP[detection.threat_type] || 'unknown',
          severity: detection.severity || "low",
          status: "attempt",
          detectedBy: "rule",
          confidence: detection.confidence || 1.0,
          payload: log.url || "",
          explanation: detection.explanation
            ? JSON.stringify(detection.explanation)
            : "",
          mitigationSuggestion: detection.explanation
            ? detection.explanation.recommended_action || ""
            : "",
          responseCode: log.responseCode,
        });
      }
    } catch (err) {
      logger.error(`[LOG_SERVICE] Post-ingest detection error: ${err.message}`);
    }
  });

  return log;
};

const getRecentLogs = async (limit = 20) => {
  return SystemLog.find({}).sort({ createdAt: -1 }).limit(limit).select("-__v");
};

module.exports = { ingestLog, getRecentLogs };
