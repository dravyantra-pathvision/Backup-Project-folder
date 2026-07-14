// controllers/driverController.js
const driverService = require('../services/driverService');
const { handleError } = require('../utils/responseHandler');
const { logAuditEvent } = require('../utils/auditLogger');

const getDrivers = async (req, res) => {
  try {
    const available = req.query.available === 'true';
    const list = available ? await driverService.getAvailableDrivers(req.user.uid) : await driverService.getAllDrivers(req.user.uid);
    res.json(list);
  } catch (err) {
    handleError(res, 'Error fetching drivers', err);
  }
};

const getAssignedDrivers = async (req, res) => {
  try {
    const list = await driverService.getAssignedDrivers(req.user.uid);
    res.json(list);
  } catch (err) {
    handleError(res, 'Error fetching assigned drivers', err);
  }
};

const createDriver = async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Driver ID is required' });
  }

  try {
    const row = await driverService.createDriver(req.user.uid, req.body);
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid,
      module: 'Driver',
      action: 'Created',
      newValue: { id, ...req.body }
    }, req);
    res.json(row);
  } catch (err) {
    handleError(res, 'Error saving driver', err);
  }
};

const updateDriver = async (req, res) => {
  const { id } = req.params;
  try {
    const row = await driverService.updateDriver(req.user.uid, id, req.body);
    if (!row) {
      return res.status(404).json({ error: 'Driver not found or unauthorized' });
    }
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid,
      module: 'Driver',
      action: 'Updated',
      newValue: { id, ...req.body }
    }, req);
    res.json(row);
  } catch (err) {
    handleError(res, 'Error updating driver', err);
  }
};

const deleteDriver = async (req, res) => {
  const { id } = req.params;
  try {
    const row = await driverService.deleteDriver(req.user.uid, id);
    if (!row) {
      return res.status(404).json({ error: 'Driver not found or unauthorized' });
    }
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.user.uid,
      module: 'Driver',
      action: 'Deleted',
      oldValue: { id }
    }, req);
    res.json({ message: 'Driver deleted successfully' });
  } catch (err) {
    handleError(res, 'Error deleting driver', err);
  }
};

module.exports = {
  getDrivers,
  getAssignedDrivers,
  createDriver,
  updateDriver
  , deleteDriver,
};
