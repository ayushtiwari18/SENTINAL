const SystemLog = require('../models/SystemLog');
const detectionConnector = require('./detectionConnector');
const attackService = require('./attackService');

const ingestLog = async (data) => {
  // 1. Save log immediately
  const log = await SystemLog.create({
    projectId:        data.projectId,
    method:           data.method,
    url:              data.url,
    ip:               data.ip,
    queryParams:      data.queryParams      || {},
    body:             data.body             || {},
    headers:          data.headers          || {},
    responseCode:     data.responseCode     || null,
    processingTimeMs: data.processingTimeMs || 0
  });

  // 2. Fire detection asynchronously — do NOT await in request cycle
  setImmediate(async () => {
    try {
      const detection = await detectionConnector.analyze(log);

      // 3. If detection engine found an attack, report it
      if (detection && detection.isAttack) {
        await attackService.reportAttack({
          requestId:            log._id,
          ip:                   log.ip,
          attackType:           detection.attackType   || 'unknown',
          severity:             detection.severity     || 'low',
          status:               detection.status       || 'attempt',
          detectedBy:           detection.detectedBy   || 'rule',
          confidence:           detection.confidence   || 1.0,
          payload:              detection.payload      || '',
          explanation:          detection.explanation  || '',
          mitigationSuggestion: detection.mitigationSuggestion || '',
          responseCode:         log.responseCode
        });
      }
    } catch (err) {
      // Silent — never crash the ingest pipeline
      console.error(`[LOG_SERVICE] Post-ingest detection error: ${err.message}`);
    }
  });

  return log;
};

const getRecentLogs = async (limit = 20) => {
  return SystemLog.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

module.exports = { ingestLog, getRecentLogs };
