// controllers/vehicleController.js
const vehicleService = require('../services/vehicleService');
const { handleError } = require('../utils/responseHandler');
const { logAuditEvent } = require('../utils/auditLogger');

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
  const { plate, make, model, type, year, fuel_type, fuel_capacity, mil, deviceId, odo, next_service } = req.body;
  if (!plate || !make || !model || !type || !year || !fuel_type || fuel_capacity === undefined || fuel_capacity === null || fuel_capacity === '' || mil === undefined || mil === null || mil === '' || !deviceId || odo === undefined || odo === null || odo === '' || !next_service) {
    return res.status(400).json({ error: 'All fields are mandatory: Vehicle Plate, Manufacturer, Model, Body Type, Manufacturing Year, Fuel Type, Fuel Tank Capacity, Baseline Mileage, IoT Telemetry Device ID, Current Odometer, and Next Service Date.' });
  }

  try {
    const row = await vehicleService.createVehicle(req.user.uid, req.body);
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid, // fleet owner is the org usually
      module: 'Vehicle',
      action: 'Created',
      newValue: { plate, ...req.body }
    }, req);
    res.json(row);
  } catch (err) {
    handleError(res, err.message || 'Error saving vehicle', err);
  }
};

const updateVehicle = async (req, res) => {
  const { plate } = req.params;
  try {
    const row = await vehicleService.updateVehicle(req.user.uid, plate, req.body);
    if (!row) {
      return res.status(404).json({ error: 'Vehicle not found or unauthorized' });
    }
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid,
      module: 'Vehicle',
      action: 'Updated',
      newValue: { plate, ...req.body }
    }, req);
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
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid,
      module: 'Vehicle',
      action: 'Deleted',
      oldValue: { plate }
    }, req);
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
