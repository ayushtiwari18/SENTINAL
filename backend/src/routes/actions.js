const express = require('express');
const router  = express.Router();
const { getPending, approveAction, rejectAction } = require('../controllers/actionQueueController');

// List all pending ArmorIQ-blocked actions
router.get('/pending', getPending);

// Human approves a blocked action
router.post('/:id/approve', approveAction);

// Human rejects a blocked action
router.post('/:id/reject', rejectAction);

module.exports = router;
