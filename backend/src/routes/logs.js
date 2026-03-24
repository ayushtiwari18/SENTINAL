const express = require('express');
const router = express.Router();
const { ingest } = require('../controllers/logController');
const { ingestLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { ingestSchema } = require('../validators/logValidator');

router.post('/ingest',
  ingestLimiter,
  validate(ingestSchema),
  ingest
);

module.exports = router;
