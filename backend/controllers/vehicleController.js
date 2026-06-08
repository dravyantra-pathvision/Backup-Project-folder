// controllers/vehicleController.js
const vehicleService = require('../services/vehicleService');
const { handleError } = require('../utils/responseHandler');

const getVehicles = async (req, res) => {
  try {
    const available = req.query.available === 'true';
    const list = available ? await vehicleService.getAvailableVehicles(req.user.uid) : await vehicleService.getAllVehicles(req.user.uid);
    res.json(list);
  } catch (err) {
    handleError(res, 'Error fetching vehicles', err);
  }
};

const createVehicle = async (req, res) => {
  const { plate } = req.body;
  if (!plate) {
    return res.status(400).json({ error: 'Vehicle plate is required' });
  }

  try {
    const row = await vehicleService.createVehicle(req.user.uid, req.body);
    res.json(row);
  } catch (err) {
    handleError(res, 'Error saving vehicle', err);
  }
};

const updateVehicle = async (req, res) => {
  const { plate } = req.params;
  try {
    const row = await vehicleService.updateVehicle(req.user.uid, plate, req.body);
    if (!row) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }
    res.json(row);
  } catch (err) {
    handleError(res, 'Error updating vehicle', err);
  }
};

const deleteVehicle = async (req, res) => {
  const { plate } = req.params;
  try {
    const row = await vehicleService.deleteVehicle(req.user.uid, plate);
    if (!row) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (err) {
    handleError(res, 'Error deleting vehicle', err);
  }
};

module.exports = {
  getVehicles,
  createVehicle,
  updateVehicle
  , deleteVehicle
};
