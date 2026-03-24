const express = require('express');
const router = express.Router();
const { report } = require('../controllers/attackController');

router.post('/report', report);

module.exports = router;
