const SystemLog = require('../models/SystemLog');

const ingestLog = async (data) => {
  const log = await SystemLog.create({
    projectId: data.projectId,
    method:    data.method,
    url:       data.url,
    ip:        data.ip,
    queryParams:      data.queryParams  || {},
    body:             data.body         || {},
    headers:          data.headers      || {},
    responseCode:     data.responseCode || null,
    processingTimeMs: data.processingTimeMs || 0
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
