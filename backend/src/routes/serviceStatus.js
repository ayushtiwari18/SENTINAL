const express = require('express');
const router = express.Router();
const { getServiceStatus } = require('../controllers/serviceStatusController');

router.get('/', getServiceStatus);

module.exports = router;
