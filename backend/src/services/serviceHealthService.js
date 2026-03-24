const axios = require('axios');
const ServiceStatus = require('../models/ServiceStatus');
const logger = require('../utils/logger');

const SERVICES = [
  {
    name: 'detection-engine',
    url:  process.env.DETECTION_ENGINE_URL || 'http://localhost:8002',
    healthPath: '/health'
  },
  {
    name: 'pcap-processor',
    url:  process.env.PCAP_PROCESSOR_URL || 'http://localhost:8001',
    healthPath: '/health'
  },
  {
    name: 'armoriq-agent',
    url:  process.env.ARMORIQ_URL || 'http://localhost:8003',
    healthPath: '/health'
  }
];

const pingService = async (service) => {
  const start = Date.now();
  try {
    await axios.get(`${service.url}${service.healthPath}`, { timeout: 3000 });
    const responseTimeMs = Date.now() - start;

    await ServiceStatus.findOneAndUpdate(
      { serviceName: service.name },
      {
        status: 'online',
        lastChecked: new Date(),
        responseTimeMs,
        errorMessage: ''
      },
      { upsert: true, new: true }
    );

    return { service: service.name, status: 'online', responseTimeMs };

  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const errorMessage = err.code || err.message;

    await ServiceStatus.findOneAndUpdate(
      { serviceName: service.name },
      {
        status: 'offline',
        lastChecked: new Date(),
        responseTimeMs,
        errorMessage
      },
      { upsert: true, new: true }
    );

    logger.warn(`[HEALTH] ${service.name} unreachable: ${errorMessage}`);
    return { service: service.name, status: 'offline', responseTimeMs, error: errorMessage };
  }
};

const checkAllServices = async () => {
  const results = await Promise.all(SERVICES.map(pingService));

  // Also include gateway itself
  results.unshift({
    service: 'gateway',
    status: 'online',
    responseTimeMs: 0
  });

  return results;
};

module.exports = { checkAllServices };
