const express = require('express');
const router  = express.Router();
const { getAlerts, markRead } = require('../controllers/alertController');
const { ingestArmorIQAlert }  = require('../controllers/alertController');

// Existing routes
router.get('/',         getAlerts);
router.patch('/:id/read', markRead);

// ArmorIQ agent posts alerts here after send_alert action is executed
router.post('/armoriq', ingestArmorIQAlert);

module.exports = router;
