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

module.exports = {
  getFuelLogs,
  createFuelLog
};
