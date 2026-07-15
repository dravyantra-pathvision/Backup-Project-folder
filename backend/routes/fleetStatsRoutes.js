const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getFleetStats,
  getVehicleStatuses,
  getDeviceStatuses,
  getFuelRefills,
  getFuelThefts,
  getTelemetryHistory
} = require('../controllers/fleetStatsController');

router.use(verifyToken);

router.get('/', getFleetStats);
router.get('/vehicles', getVehicleStatuses);
router.get('/devices', getDeviceStatuses);
router.get('/fuel/refills', getFuelRefills);
router.get('/fuel/thefts', getFuelThefts);
router.get('/telemetry', getTelemetryHistory);

module.exports = router;
