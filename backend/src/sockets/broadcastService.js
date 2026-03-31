const emitter = require('../utils/eventEmitter');
const logger  = require('../utils/logger');

let io = null;

const EVENTS = {
  ATTACK_NEW:     'attack:new',
  ALERT_NEW:      'alert:new',
  SERVICE_STATUS: 'service:status',
  STATS_UPDATE:   'stats:update',
  ACTION_PENDING: 'action:pending',  // Nexus blocked action awaiting human review
  AUDIT_NEW:      'audit:new'        // Nexus policy decision logged (ALLOW or BLOCK)
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

  // Nexus blocked action — notify Dashboard ActionQueue
  emitter.on(EVENTS.ACTION_PENDING, (actionData) => {
    if (!io) return;
    io.emit(EVENTS.ACTION_PENDING, {
      event:     EVENTS.ACTION_PENDING,
      timestamp: new Date().toISOString(),
      data:      actionData
    });
    logger.info(`[BROADCAST] action:pending → ${actionData.action} for ip=${actionData.ip}`);
  });

  // Nexus audit decision — notify Dashboard AuditLog panel in real time
  emitter.on(EVENTS.AUDIT_NEW, (auditData) => {
    if (!io) return;
    io.emit(EVENTS.AUDIT_NEW, {
      event:     EVENTS.AUDIT_NEW,
      timestamp: new Date().toISOString(),
      data:      auditData
    });
    logger.info(`[BROADCAST] audit:new → ${auditData.action} ${auditData.status} (rule=${auditData.policy_rule_id})`);
  });

  logger.info('[BROADCAST] Broadcast service listening for events (incl. action:pending, audit:new)');
};

module.exports = { init, EVENTS };
