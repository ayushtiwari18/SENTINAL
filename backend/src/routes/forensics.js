const express = require('express');
const router  = express.Router();
const { getForensics } = require('../controllers/forensicsController');

// GET /api/attacks/:id/forensics
router.get('/:id/forensics', getForensics);

module.exports = router;
