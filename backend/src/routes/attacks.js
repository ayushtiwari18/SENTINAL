const express = require('express');
const router = express.Router();
const { report, getRecent } = require('../controllers/attackController');
const validate = require('../middleware/validate');
const { reportSchema } = require('../validators/attackValidator');

// GET /api/attacks/recent
router.get('/recent', getRecent);

// POST /api/attacks/report
router.post('/report',
  validate(reportSchema),
  report
);

module.exports = router;
