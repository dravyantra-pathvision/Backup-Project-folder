// controllers/fuelController.js
const fuelService = require('../services/fuelService');
const { handleError } = require('../utils/responseHandler');

const getFuelLogs = async (req, res) => {
  try {
    const list = await fuelService.getAllFuelLogs(req.user.uid);
    res.json(list);
  } catch (err) {
    handleError(res, 'Error fetching fuel logs', err);
  }
};

const createFuelLog = async (req, res) => {
  try {
    const row = await fuelService.createFuelLog(req.user.uid, req.body);
    res.json(row);
  } catch (err) {
    handleError(res, 'Error saving fuel log', err);
  }
};

const getFuelRates = async (req, res) => {
  try {
    // Generate realistic daily changing diesel rates for major Indian cities
    const today = new Date();
    const daySeed = today.getFullYear() * 1000 + today.getMonth() * 100 + today.getDate();
    // Deterministic offset based on date seed (adds or subtracts a small daily variance)
    const getOffset = (seed) => {
      const x = Math.sin(seed) * 10000;
      return Math.round((x - Math.floor(x)) * 100) / 100 - 0.5; // -0.50 to +0.50
    };

    const offset = getOffset(daySeed);

    const rates = [
      { city: 'Mumbai', rate: `₹${(89.97 + offset).toFixed(2)}` },
      { city: 'Delhi', rate: `₹${(87.62 + offset * 0.8).toFixed(2)}` },
      { city: 'Bangalore', rate: `₹${(88.94 + offset * 1.1).toFixed(2)}` },
      { city: 'Chennai', rate: `₹${(90.12 + offset * 0.9).toFixed(2)}` },
      { city: 'Kolkata', rate: `₹${(90.76 + offset * 1.2).toFixed(2)}` },
    ];
    res.json(rates);
  } catch (err) {
    handleError(res, 'Error fetching fuel rates', err);
  }
};

module.exports = {
  getFuelLogs,
  createFuelLog,
  getFuelRates
};
