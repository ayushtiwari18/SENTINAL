const express = require('express');
const router  = express.Router();
const { ingestAudit, getAuditLog } = require('../controllers/auditController');

// ArmorIQ agent POSTs every policy decision here
router.post('/ingest', ingestAudit);

// Dashboard / judges fetch full audit log
router.get('/', getAuditLog);

module.exports = router;
