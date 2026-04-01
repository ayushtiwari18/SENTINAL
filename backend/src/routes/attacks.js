const express = require('express');
const router  = express.Router();

const { report, getRecent }           = require('../controllers/attackController');
const { searchAttacks, searchStats }  = require('../controllers/atlasSearchController');
const validate                        = require('../middleware/validate');
const { reportSchema }                = require('../validators/attackValidator');

// GET /api/attacks/search?q=<term>   — Atlas Search (Phase 5)
router.get('/search', searchAttacks);

// GET /api/attacks/search/stats      — Atlas Aggregation stats
router.get('/search/stats', searchStats);

// GET /api/attacks/recent
router.get('/recent', getRecent);

// POST /api/attacks/report
router.post('/report',
  validate(reportSchema),
  report
);

module.exports = router;
