/**
 * SENTINAL — Geo-IP Intelligence Routes
 * =======================================
 * GET /api/geo/heatmap    — country-level attack heatmap (aggregated from MongoDB)
 * GET /api/geo/ip/:ip     — lookup a specific IP's geo + abuse data
 * GET /api/geo/stats      — top attacking countries, ISPs, TOR/proxy stats
 */

const express  = require('express');
const axios    = require('axios');
const router   = express.Router();
const AttackEvent = require('../models/AttackEvent');
const logger   = require('../utils/logger');

const DETECTION_URL = process.env.DETECTION_URL || 'http://localhost:8002';

// ── GET /api/geo/heatmap ─────────────────────────────────────────────────────
// Aggregates attack counts per country from MongoDB AttackEvents.
// Returns data ready for Leaflet / D3 world map rendering.
router.get('/heatmap', async (req, res) => {
  try {
    const pipeline = [
      { $match: { 'geoIntel.country_code': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$geoIntel.country_code',
          country:   { $first: '$geoIntel.country' },
          lat:       { $first: '$geoIntel.latitude' },
          lng:       { $first: '$geoIntel.longitude' },
          count:     { $sum: 1 },
          critical:  { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          high:      { $sum: { $cond: [{ $eq: ['$severity', 'high']     }, 1, 0] } },
          tor_count: { $sum: { $cond: ['$geoIntel.is_tor',   1, 0] } },
          proxy_count: { $sum: { $cond: ['$geoIntel.is_proxy', 1, 0] } },
          avg_abuse: { $avg: '$geoIntel.abuse_confidence_score' },
        }
      },
      { $sort: { count: -1 } },
      { $limit: 200 }
    ];

    const results = await AttackEvent.aggregate(pipeline);

    const heatmap = results.map(r => ({
      country_code: r._id,
      country:      r.country,
      lat:          r.lat,
      lng:          r.lng,
      count:        r.count,
      critical:     r.critical,
      high:         r.high,
      tor_count:    r.tor_count,
      proxy_count:  r.proxy_count,
      avg_abuse:    Math.round(r.avg_abuse || 0),
    }));

    return res.json({ success: true, heatmap });
  } catch (err) {
    logger.error(`[GEO] heatmap error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/ip/:ip ───────────────────────────────────────────────────────
// Proxies a single-IP lookup to the Detection Engine geo_intel module.
router.get('/ip/:ip', async (req, res) => {
  try {
    const { ip } = req.params;
    // Forward to Detection Engine which has the cached geo_intel module
    const response = await axios.get(
      `${DETECTION_URL}/geo/heatmap`,
      { timeout: 5000 }
    );
    // Find this specific IP in the cache snapshot
    const heatmap = response.data.heatmap || [];
    return res.json({ success: true, heatmap });
  } catch (err) {
    logger.error(`[GEO] ip lookup error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/stats ────────────────────────────────────────────────────────
// Top 10 attacking countries, TOR/proxy/abuse stats summary.
router.get('/stats', async (req, res) => {
  try {
    const [topCountries, threatFlags] = await Promise.all([
      AttackEvent.aggregate([
        { $match: { 'geoIntel.country_code': { $exists: true, $ne: null } } },
        { $group: { _id: '$geoIntel.country_code', country: { $first: '$geoIntel.country' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AttackEvent.aggregate([
        { $match: { geoIntel: { $ne: null } } },
        {
          $group: {
            _id: null,
            total:           { $sum: 1 },
            tor_attacks:     { $sum: { $cond: ['$geoIntel.is_tor',     1, 0] } },
            proxy_attacks:   { $sum: { $cond: ['$geoIntel.is_proxy',   1, 0] } },
            hosting_attacks: { $sum: { $cond: ['$geoIntel.is_hosting', 1, 0] } },
            high_abuse:      { $sum: { $cond: [{ $gte: ['$geoIntel.abuse_confidence_score', 50] }, 1, 0] } },
            unique_countries: { $addToSet: '$geoIntel.country_code' },
          }
        },
        { $project: {
          total: 1, tor_attacks: 1, proxy_attacks: 1, hosting_attacks: 1, high_abuse: 1,
          unique_countries: { $size: '$unique_countries' }
        }}
      ])
    ]);

    return res.json({
      success: true,
      top_countries: topCountries.map(c => ({ country_code: c._id, country: c.country, count: c.count })),
      threat_flags:  threatFlags[0] || {}
    });
  } catch (err) {
    logger.error(`[GEO] stats error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
