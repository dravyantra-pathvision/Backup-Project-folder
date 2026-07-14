// modules/admin/alerts.controller.js
const alertsService = require('./alerts.service');
const { handleError } = require('../../utils/responseHandler');

const getAllAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, organization, fleetOwner,
            severity, status, type, vehicle, driver, fromDate, toDate, sort } = req.query;
    const result = await alertsService.getAllAlerts({
      page: parseInt(page), limit: parseInt(limit),
      search, organization, fleetOwner, severity, status, type, vehicle, driver, fromDate, toDate, sort
    });
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Error fetching alerts', err);
  }
};

const getAlertById = async (req, res) => {
  try {
    const alert = await alertsService.getAlertById(req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
    res.json({ success: true, data: alert });
  } catch (err) {
    handleError(res, 'Error fetching alert', err);
  }
};

const updateAlertStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) return res.status(400).json({ success: false, error: 'Status is required' });
    const adminUid = req.admin?.uid || 'admin';
    const updated = await alertsService.updateAlertStatus(req.params.id, status, adminUid, notes);
    res.json({ success: true, data: updated });
  } catch (err) {
    handleError(res, 'Error updating alert status', err);
  }
};

const addAlertComment = async (req, res) => {
  try {
    const { comment } = req.body;
    if (!comment) return res.status(400).json({ success: false, error: 'Comment is required' });
    const adminUid = req.admin?.uid || 'admin';
    const result = await alertsService.addAlertComment(req.params.id, comment, adminUid);
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Error adding comment', err);
  }
};

const notifyFleetOwner = async (req, res) => {
  try {
    const adminUid = req.admin?.uid || 'admin';
    const result = await alertsService.notifyFleetOwner(req.params.id, adminUid);
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Error notifying fleet owner', err);
  }
};

const getAlertStatistics = async (req, res) => {
  try {
    const stats = await alertsService.getAlertStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, 'Error fetching alert statistics', err);
  }
};

const getAlertFilterOptions = async (req, res) => {
  try {
    const options = await alertsService.getAlertFilterOptions();
    res.json({ success: true, data: options });
  } catch (err) {
    handleError(res, 'Error fetching filter options', err);
  }
};

module.exports = {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertComment,
  notifyFleetOwner,
  getAlertStatistics,
  getAlertFilterOptions,
};
