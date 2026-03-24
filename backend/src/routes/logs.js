const express = require('express');
const router = express.Router();
const { ingest } = require('../controllers/logController');

router.post('/ingest', ingest);

module.exports = router;
