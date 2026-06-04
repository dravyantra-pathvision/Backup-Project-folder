// controllers/tripController.js
const tripService = require('../services/storageWrapper');
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

// Simple in-memory throttle map to prevent excessive trip writes
// Keyed by trip id -> epoch ms of last write attempt
const _lastTripWriteAt = new Map();
// Minimum interval between writes for the same trip (ms)
const TRIP_WRITE_MIN_INTERVAL_MS = Number(process.env.TRIP_WRITE_MIN_INTERVAL_MS) || 1000;

const createTrip = async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Trip ID is required' });
  }

  // Throttle very-frequent create requests for the same trip id
  try {
    const last = _lastTripWriteAt.get(id) || 0;
    const now = Date.now();
    if (now - last < TRIP_WRITE_MIN_INTERVAL_MS) {
      return res.status(429).json({ error: 'Too many requests - try again later' });
    }
    _lastTripWriteAt.set(id, now);
  } catch (e) {}

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
  // Throttle very-frequent updates for the same trip id
  try {
    const last = _lastTripWriteAt.get(id) || 0;
    const now = Date.now();
    if (now - last < TRIP_WRITE_MIN_INTERVAL_MS) {
      return res.status(429).json({ error: 'Too many requests - try again later' });
    }
    _lastTripWriteAt.set(id, now);
  } catch (e) {}
  try {
    const row = await tripService.updateTrip(req.user.uid, id, req.body);
    if (!row) {
      return res.status(404).json({ error: 'Trip not found or unauthorized' });
    }
    res.json(mapTripRow(row));
  } catch (err) {
    if (err && err.code === 'STALE_UPDATE') {
      return res.status(409).json({ error: 'Stale update rejected: database has newer data' });
    }
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

const notifyTrip = async (req, res) => {
  const { id } = req.params;
  try {
    // get current trip from storage (DB preferred, falls back to local)
    const list = await tripService.getAllTrips(req.user.uid);
    const updated = list.find(t => t.id === id);
    if (!updated) return res.status(404).json({ error: 'Trip not found' });
    // call detector (it will read prev from local file if prev not provided)
    const detector = require('../services/fuelTheftDetector');
    try { await detector.checkAndAlert(null, updated); } catch (e) { console.error('notifyTrip detector error', e && e.message); }
    res.json({ message: 'Detector invoked', trip: updated });
  } catch (err) {
    handleError(res, 'Error invoking detector', err);
  }
};

const getSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const summary = await tripService.getSummary(req.user.uid, from || null, to || null);
    const totalFuelRupees = Math.round((summary.totalFuelUsed || 0) * 100);
    const totalIdleMinutes = Number(summary.totalIdleMinutes || 0);
    // Prefer DB-stored idle rupees if available (populated by update script / migrations)
    // Fallback formula: idle_money_wasted = total_idle_time * 1.7
    const totalIdleRupees = Number(summary.totalIdleRupees !== undefined ? summary.totalIdleRupees : Number(((totalIdleMinutes) * 1.7).toFixed(2)));
    const totalIdleHours = totalIdleMinutes / 60;
    res.json({
      totalFuelLiters: Math.round(summary.totalFuelUsed || 0),
      totalFuelRupees,
      totalFuelWastedLiters: Math.round(summary.totalFuelWasted || 0),
      totalFuelSavedLiters: Math.round(summary.totalFuelSaved || 0),
      totalMoneyWasted: Number((summary.totalMoneyWasted || 0).toFixed(2)),
      totalMoneySaved: Number((summary.totalMoneySaved || 0).toFixed(2)),
      totalIdleSeconds: Math.round((summary.totalIdleMinutes || 0) * 60),
      totalIdleMinutes: Math.round(totalIdleMinutes),
      totalIdleHours: Number(totalIdleHours.toFixed(2)),
      totalIdleRupees,
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

module.exports.notifyTrip = notifyTrip;
