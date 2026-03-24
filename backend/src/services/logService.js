const SystemLog = require('../models/SystemLog');
const detectionConnector = require('./detectionConnector');
const attackService = require('./attackService');
const logger = require('../utils/logger');

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
    processingTimeMs: data.processingTimeMs || 0
  });

  if (process.env.NODE_ENV === 'test') return log;

  setImmediate(async () => {
    try {
      const detection = await detectionConnector.analyze(log);
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
      logger.error(`[LOG_SERVICE] Post-ingest detection error: ${err.message}`);
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
