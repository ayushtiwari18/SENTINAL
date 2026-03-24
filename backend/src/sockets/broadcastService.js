const emitter = require('../utils/eventEmitter');

let io = null;

const EVENTS = {
  ATTACK_NEW:      'attack:new',
  ALERT_NEW:       'alert:new',
  SERVICE_STATUS:  'service:status',
  STATS_UPDATE:    'stats:update'
};

const init = (ioInstance) => {
  io = ioInstance;

  // Listen for new attacks and broadcast to all dashboard clients
  emitter.on(EVENTS.ATTACK_NEW, (attackData) => {
    if (!io) return;
    io.emit(EVENTS.ATTACK_NEW, {
      event: EVENTS.ATTACK_NEW,
      timestamp: new Date().toISOString(),
      data: attackData
    });
    console.log(`[BROADCAST] attack:new → ${attackData.attackType} from ${attackData.ip}`);
  });

  // Listen for new alerts
  emitter.on(EVENTS.ALERT_NEW, (alertData) => {
    if (!io) return;
    io.emit(EVENTS.ALERT_NEW, {
      event: EVENTS.ALERT_NEW,
      timestamp: new Date().toISOString(),
      data: alertData
    });
    console.log(`[BROADCAST] alert:new → ${alertData.severity} severity`);
  });

  // Listen for service status changes
  emitter.on(EVENTS.SERVICE_STATUS, (statusData) => {
    if (!io) return;
    io.emit(EVENTS.SERVICE_STATUS, {
      event: EVENTS.SERVICE_STATUS,
      timestamp: new Date().toISOString(),
      data: statusData
    });
  });

  console.log('[BROADCAST] Broadcast service listening for events');
};

module.exports = { init, EVENTS };
