const express = require('express');
const router  = express.Router();
const { getAlerts, markRead, ingestArmorIQAlert } = require('../controllers/alertController');

// ArmorIQ agent posts alerts here — MUST be before /:id routes to avoid route conflicts
router.post('/armoriq', ingestArmorIQAlert);

// Existing routes
router.get('/',           getAlerts);
router.patch('/:id/read', markRead);

module.exports = router;
