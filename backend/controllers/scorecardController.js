// controllers/scorecardController.js
'use strict';
const driverScorecardEngine = require('../services/driverScorecardEngine');
const vehicleHealthEngine = require('../services/vehicleHealthEngine');

exports.getDriverScorecard = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { driverId, period, from, to } = req.query;

    const data = await driverScorecardEngine.getDriverScorecard(uid, driverId, period || 'month', from, to);
    return res.json(data);
  } catch (error) {
    console.error('Error in getDriverScorecard:', error);
    return res.status(500).json({ error: 'Failed to calculate driver scorecard' });
  }
};

exports.getVehicleHealth = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { vehicleId, period, from, to } = req.query;

    const data = await vehicleHealthEngine.getVehicleHealth(uid, vehicleId, period || 'month', from, to);
    return res.json(data);
  } catch (error) {
    console.error('Error in getVehicleHealth:', error);
    return res.status(500).json({ error: 'Failed to calculate vehicle health score' });
  }
};
