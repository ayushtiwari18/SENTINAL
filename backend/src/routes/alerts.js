const express = require('express');
const router  = express.Router();
const { getAlerts, markRead, ingestNexusAlert } = require('../controllers/alertController');

// Nexus agent posts alerts here — MUST be before /:id routes to avoid route conflicts
router.post('/Nexus', ingestNexusAlert);

// Existing routes
router.get('/',           getAlerts);
router.patch('/:id/read', markRead);

module.exports = router;
