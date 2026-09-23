// config/scoringConfig.js
// Audited Scoring Thresholds & Weights for DravYantra Driver Scorecard & Vehicle Health Engine

module.exports = {
  driverScore: {
    basePoints: 100,
    maxOverspeedPenalty: 25,
    overspeedRateMultiplier: 5.0, // per 100 km
    maxIdlingPenalty: 25,
    idleRateMultiplier: 4.0, // idle hours per 100 km
    maxEfficiencyPenalty: 25,
    efficiencyRatioMultiplier: 40.0,
    maxRashPenalty: 25,
    rashRateMultiplier: 5.0,
  },
  vehicleHealth: {
    basePoints: 100,
    vibrationThreshold: 5.0,
    vibrationMultiplier: 3.0,
    maxVibrationPenalty: 25,
    maxEfficiencyPenalty: 25,
    efficiencyMultiplier: 5.0,
    maxAlertsPenalty: 25,
    alertMultiplier: 5.0,
    maxFuelPenalty: 25,
    fuelMultiplier: 5.0,
  },
};
