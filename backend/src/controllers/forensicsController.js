const AttackEvent = require('../models/AttackEvent');
const SystemLog   = require('../models/SystemLog');
const logger      = require('../utils/logger');

const classifyAttackChain = (events) => {
  const types = new Set(events.map(e => e.attackType));
  const reconTypes = ['recon', 'traversal', 'lfi_rfi'];
  const hasRecon = events.some(e => reconTypes.includes(e.attackType));

  if (hasRecon && types.size >= 3)       return 'APT-style automated scanner';
  if (events.filter(e => e.attackType === 'brute_force').length >= 10)
                                          return 'Credential stuffing attack';
  if (types.has('webshell'))             return 'Post-exploitation attempt';
  if (types.size === 1)                  return 'Focused single-vector attack';
  return 'Opportunistic scanner';
};

const getForensics = async (req, res) => {
  try {
    const { id } = req.params;

    // Query 1 — Full attack + raw request joined
    const attack = await AttackEvent.findById(id)
      .populate('requestId')
      .lean();

    if (!attack) {
      return res.status(404).json({
        success: false,
        message: 'Attack not found',
        code: 'NOT_FOUND'
      });
    }

    const ip = attack.ip;
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Query 2 — All requests from this IP in last 24h
    const ipHistory = await SystemLog.find({
      ip,
      timestamp: { $gte: since24h }
    })
      .sort({ timestamp: 1 })
      .select('method url timestamp responseCode')
      .limit(100)
      .lean();

    // Query 3 — All attacks from this IP ever
    const allAttacks = await AttackEvent.find({ ip })
      .sort({ timestamp: -1 })
      .select('attackType severity status timestamp confidence')
      .limit(50)
      .lean();

    // Build attack chain timeline
    const attackChain = ipHistory.map(req => ({
      time:   req.timestamp,
      method: req.method,
      url:    req.url,
      code:   req.responseCode
    }));

    const patternLabel = classifyAttackChain(allAttacks);

    return res.status(200).json({
      success: true,
      message: 'Operation successful',
      data: {
        attack: {
          id:          attack._id,
          attackType:  attack.attackType,
          severity:    attack.severity,
          confidence:  attack.confidence,
          status:      attack.status,
          detectedBy:  attack.detectedBy,
          payload:     attack.payload,
          explanation: attack.explanation,
          timestamp:   attack.timestamp
        },
        raw_request: attack.requestId ? {
          method:      attack.requestId.method,
          url:         attack.requestId.url,
          ip:          attack.requestId.ip,
          headers:     attack.requestId.headers,
          body:        attack.requestId.body,
          queryParams: attack.requestId.queryParams,
          responseCode: attack.requestId.responseCode
        } : null,
        ip_intel: {
          ip,
          total_requests_24h:  ipHistory.length,
          total_attacks_ever:  allAttacks.length,
          first_attack:        allAttacks.length ? allAttacks[allAttacks.length - 1].timestamp : null,
          last_attack:         allAttacks.length ? allAttacks[0].timestamp : null,
          attack_types_seen:   [...new Set(allAttacks.map(a => a.attackType))]
        },
        attack_chain: {
          timeline:      attackChain,
          pattern_label: patternLabel,
          all_attacks:   allAttacks
        }
      }
    });

  } catch (err) {
    logger.error(`[FORENSICS] ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Forensics query failed',
      code: 'SERVER_ERROR'
    });
  }
};

module.exports = { getForensics };
