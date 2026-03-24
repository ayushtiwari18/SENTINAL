const express = require('express');
const router = express.Router();
const { report } = require('../controllers/attackController');
const validate = require('../middleware/validate');
const { reportSchema } = require('../validators/attackValidator');

router.post('/report',
  validate(reportSchema),
  report
);

module.exports = router;
