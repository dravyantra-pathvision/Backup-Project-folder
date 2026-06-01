const express = require('express');
const router = express.Router();
const { getFleetSettings, putFleetSettings } = require('../controllers/fleetSettingsController');

router.get('/', getFleetSettings);
router.put('/', putFleetSettings);

module.exports = router;