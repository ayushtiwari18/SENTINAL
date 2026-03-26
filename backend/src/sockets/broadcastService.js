const emitter = require('../utils/eventEmitter');
const logger  = require('../utils/logger');

let io = null;

const EVENTS = {
  ATTACK_NEW:     'attack:new',
  ALERT_NEW:      'alert:new',
  SERVICE_STATUS: 'service:status',
  STATS_UPDATE:   'stats:update',
  ACTION_PENDING: 'action:pending'   // ArmorIQ blocked action awaiting human review
};

const init = (ioInstance) => {
  io = ioInstance;

  emitter.on(EVENTS.ATTACK_NEW, (attackData) => {
    if (!io) return;
    io.emit(EVENTS.ATTACK_NEW, {
      event:     EVENTS.ATTACK_NEW,
      timestamp: new Date().toISOString(),
      data:      attackData
    });
    logger.info(`[BROADCAST] attack:new → ${attackData.attackType} from ${attackData.ip}`);
  });

  emitter.on(EVENTS.ALERT_NEW, (alertData) => {
    if (!io) return;
    io.emit(EVENTS.ALERT_NEW, {
      event:     EVENTS.ALERT_NEW,
      timestamp: new Date().toISOString(),
      data:      alertData
    });
    logger.info(`[BROADCAST] alert:new → ${alertData.severity} severity`);
  });

  emitter.on(EVENTS.SERVICE_STATUS, (statusData) => {
    if (!io) return;
    io.emit(EVENTS.SERVICE_STATUS, {
      event:     EVENTS.SERVICE_STATUS,
      timestamp: new Date().toISOString(),
      data:      statusData
    });
  });

  // ArmorIQ blocked action — notify Dashboard ActionQueue
  emitter.on(EVENTS.ACTION_PENDING, (actionData) => {
    if (!io) return;
    io.emit(EVENTS.ACTION_PENDING, {
      event:     EVENTS.ACTION_PENDING,
      timestamp: new Date().toISOString(),
      data:      actionData
    });
    logger.info(`[BROADCAST] action:pending → ${actionData.action} for ip=${actionData.ip}`);
  });

  logger.info('[BROADCAST] Broadcast service listening for events (incl. action:pending)');
};

module.exports = { init, EVENTS };
