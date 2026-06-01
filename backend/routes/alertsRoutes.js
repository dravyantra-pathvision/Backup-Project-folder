const express = require('express');
const router = express.Router();
const { getAlerts, clearAlerts } = require('../controllers/alertsController');

router.get('/', getAlerts);
router.delete('/', clearAlerts);

module.exports = router;
