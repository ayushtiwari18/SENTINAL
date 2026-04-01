/**
 * atlasSearchController.js
 * Phase 5 — MongoDB Atlas Advanced Feature: Atlas Search
 *
 * GET /api/attacks/search?q=<term>&limit=20&page=1
 *
 * Uses $search aggregation stage (Atlas Search index on 'attackevents').
 * Falls back gracefully to $regex if Atlas Search index is not yet provisioned.
 */
const AttackEvent = require('../models/AttackEvent');
const logger      = require('../utils/logger');

/**
 * Primary handler — Atlas $search aggregation
 */
const searchAttacks = async (req, res) => {
  const startTime = Date.now();
  const q         = (req.query.q || '').trim();
  const limit     = Math.min(parseInt(req.query.limit) || 20, 100);
  const page      = Math.max(parseInt(req.query.page)  || 1,  1);
  const skip      = (page - 1) * limit;

  if (!q) {
    return res.status(400).json({
      success : false,
      message : 'Query parameter "q" is required',
      example : '/api/attacks/search?q=union+select'
    });
  }

  try {
    // ── Strategy 1: Atlas $search (requires search index to be provisioned) ──
    const pipeline = [
      {
        $search: {
          index: 'attackevents_search',
          text: {
            query: q,
            path : ['payload', 'ip', 'attackType', 'explanation', 'mitigationSuggestion'],
            fuzzy: { maxEdits: 1 }
          }
        }
      },
      {
        $addFields: {
          score: { $meta: 'searchScore' }
        }
      },
      { $sort: { score: -1, timestamp: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id        : 1,
          ip         : 1,
          attackType : 1,
          severity   : 1,
          status     : 1,
          payload    : 1,
          explanation: 1,
          timestamp  : 1,
          detectedBy : 1,
          confidence : 1,
          score      : 1
        }
      }
    ];

    const results = await AttackEvent.aggregate(pipeline);
    const latency = Date.now() - startTime;

    logger.info(`[ATLAS_SEARCH] query="${q}" hits=${results.length} latency=${latency}ms`);

    return res.json({
      success   : true,
      query     : q,
      page,
      limit,
      count     : results.length,
      latencyMs : latency,
      source    : 'atlas_search',
      results
    });

  } catch (atlasErr) {
    // ── Strategy 2: Fallback to $regex if Atlas Search index not ready ────────
    logger.warn(`[ATLAS_SEARCH] Atlas $search failed (${atlasErr.message}), falling back to $regex`);

    try {
      const regex   = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const query   = {
        $or: [
          { payload    : regex },
          { ip         : regex },
          { attackType : regex },
          { explanation: regex }
        ]
      };

      const [results, total] = await Promise.all([
        AttackEvent.find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AttackEvent.countDocuments(query)
      ]);

      const latency = Date.now() - startTime;
      logger.info(`[REGEX_SEARCH] query="${q}" hits=${results.length} total=${total} latency=${latency}ms`);

      return res.json({
        success   : true,
        query     : q,
        page,
        limit,
        count     : results.length,
        total,
        latencyMs : latency,
        source    : 'regex_fallback',
        note      : 'Atlas Search index not yet provisioned — using regex fallback. Provision index "attackevents_search" in Atlas UI for full-text search.',
        results
      });
    } catch (regexErr) {
      logger.error(`[SEARCH] Both strategies failed: ${regexErr.message}`);
      return res.status(500).json({
        success : false,
        message : 'Search failed',
        error   : regexErr.message
      });
    }
  }
};

/**
 * GET /api/attacks/search/stats
 * Aggregation pipeline: attack breakdown by type + severity (Atlas demo-ready)
 */
const searchStats = async (req, res) => {
  try {
    const pipeline = [
      {
        $facet: {
          byAttackType: [
            { $group: { _id: '$attackType', count: { $sum: 1 }, avgConfidence: { $avg: '$confidence' } } },
            { $sort: { count: -1 } }
          ],
          bySeverity: [
            { $group: { _id: '$severity', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          byDetectionMethod: [
            { $group: { _id: '$detectedBy', count: { $sum: 1 } } }
          ],
          recentTrend: [
            {
              $match: {
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
              }
            },
            {
              $group: {
                _id: {
                  hour : { $hour: '$timestamp' },
                  type : '$attackType'
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { '_id.hour': 1 } }
          ],
          totalCount: [
            { $count: 'total' }
          ]
        }
      }
    ];

    const [stats] = await AttackEvent.aggregate(pipeline);
    return res.json({ success: true, stats });
  } catch (err) {
    logger.error(`[SEARCH_STATS] ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { searchAttacks, searchStats };
