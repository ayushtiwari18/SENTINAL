const SystemLog          = require('../models/SystemLog');
const detectionConnector = require('./detectionConnector');
const attackService      = require('./attackService');
const logger             = require('../utils/logger');

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

/**
 * Map the detection engine's scored_by field to AttackEvent.detectedBy enum.
 * Detection engine returns: 'rule_engine' | 'ml_model' | 'hybrid'
 * AttackEvent schema expects: 'rule' | 'ml' | 'both'
 */
const mapDetectedBy = (scoredBy) => {
  if (scoredBy === 'hybrid')   return 'both';
  if (scoredBy === 'ml_model') return 'ml';
  return 'rule';
};

/**
 * Safely serialize the explanation field.
 * Detection engine returns explanation as a plain object.
 * AttackEvent stores it as a JSON string so parseExplanation() in the
 * frontend can parse it back. Never double-stringify.
 */
const serializeExplanation = (exp) => {
  if (!exp) return '';
  if (typeof exp === 'string') return exp;   // already serialized — pass through
  try { return JSON.stringify(exp); } catch { return ''; }
};

/**
 * Extract mitigationSuggestion from whatever shape explanation arrives in.
 */
const extractMitigation = (exp) => {
  if (!exp) return '';
  if (typeof exp === 'object') return exp.recommended_action || '';
  try {
    const parsed = JSON.parse(exp);
    return parsed.recommended_action || '';
  } catch { return ''; }
};

const ingestLog = async (data) => {
  const log = await SystemLog.create({
    projectId:        data.projectId,
    method:           data.method,
    url:              data.url,
    ip:               data.ip,
    queryParams:      data.queryParams      || {},
    body:             data.body             || {},
    headers:          data.headers          || {},
    responseCode:     data.responseCode     || null,
    processingTimeMs: data.processingTimeMs || 0,
  });

  if (process.env.NODE_ENV === 'test') return log;

  setImmediate(async () => {
    try {
      const detection = await detectionConnector.analyze(log);
      if (detection && detection.threat_detected) {
        await attackService.reportAttack({
          requestId:            log._id,
          ip:                   log.ip,
          attackType:           ATTACK_TYPE_MAP[detection.threat_type] || 'unknown',
          severity:             detection.severity             || 'low',
          status:               'attempt',
          detectedBy:           mapDetectedBy(detection.scored_by),
          confidence:           detection.confidence           || 1.0,
          payload:              log.url                        || '',
          explanation:          serializeExplanation(detection.explanation),
          mitigationSuggestion: extractMitigation(detection.explanation),
          responseCode:         log.responseCode,
        });
      }
    } catch (err) {
      logger.error(`[LOG_SERVICE] Post-ingest detection error: ${err.message}`);
    }
  });

  return log;
};

const getRecentLogs = async (limit = 20) =>
  SystemLog.find({}).sort({ createdAt: -1 }).limit(limit).select('-__v');

module.exports = { ingestLog, getRecentLogs };
