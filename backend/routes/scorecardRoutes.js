// routes/scorecardRoutes.js
'use strict';
const express = require('express');
const router = express.Router();
const scorecardController = require('../controllers/scorecardController');

router.get('/driver-scorecard', scorecardController.getDriverScorecard);
router.get('/vehicle-health', scorecardController.getVehicleHealth);

module.exports = router;
