const express = require('express');
const router = express.Router();
const { getAlerts, markRead } = require('../controllers/alertController');

// GET /api/alerts
router.get('/', getAlerts);

// PATCH /api/alerts/:id/read
router.patch('/:id/read', markRead);

module.exports = router;
