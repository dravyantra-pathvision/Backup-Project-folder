// controllers/tripController.js
const tripService = require('../services/tripService');
const { mapTripRow } = require('../utils/helpers');
const { handleError } = require('../utils/responseHandler');

const getTrips = async (req, res) => {
  try {
    const list = await tripService.getAllTrips(req.user.uid);
    const mapped = list.map(mapTripRow);
    res.json(mapped);
  } catch (err) {
    handleError(res, 'Error fetching trips', err);
  }
};

const createTrip = async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Trip ID is required' });
  }

  try {
    const row = await tripService.createTrip(req.user.uid, req.body);
    res.json(mapTripRow(row));
  } catch (err) {
    // Handle assignment conflicts with a 400 response
    if (err && (err.code === 'ASSIGNED_VEHICLE' || err.code === 'ASSIGNED_DRIVER')) {
      return res.status(400).json({ error: err.message });
    }
    handleError(res, 'Error saving trip', err);
  }
};

const updateTrip = async (req, res) => {
  const { id } = req.params;
  try {
    const row = await tripService.updateTrip(req.user.uid, id, req.body);
    if (!row) {
      return res.status(404).json({ error: 'Trip not found or unauthorized' });
    }
    res.json(mapTripRow(row));
  } catch (err) {
    handleError(res, 'Error updating trip', err);
  }
};

const deleteTrip = async (req, res) => {
  const { id } = req.params;
  try {
    const row = await tripService.deleteTrip(req.user.uid, id);
    if (!row) {
      return res.status(404).json({ error: 'Trip not found or unauthorized' });
    }
    res.json({ message: 'Trip deleted successfully' });
  } catch (err) {
    handleError(res, 'Error deleting trip', err);
  }
};

const getSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const summary = await tripService.getSummary(req.user.uid, from || null, to || null);
    // total fuel spend in rupees (user requested: fuel_used * 100)
      const totalFuelRupees = Math.round((summary.totalFuelUsed || 0) * 100);
      res.json({
        totalFuelLiters: Math.round(summary.totalFuelUsed || 0),
        totalFuelRupees,
        totalFuelWastedLiters: Math.round(summary.totalFuelWasted || 0),
        totalFuelSavedLiters: Math.round(summary.totalFuelSaved || 0),
        totalMoneyWasted: Math.round(summary.totalMoneyWasted || 0),
        totalMoneySaved: Math.round(summary.totalMoneySaved || 0),
      });
  } catch (err) {
    handleError(res, 'Error fetching trips summary', err);
  }
};

module.exports = {
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  getSummary
};
