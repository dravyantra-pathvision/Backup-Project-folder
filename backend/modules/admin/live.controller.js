// modules/admin/live.controller.js
const liveService = require('./live.service');
const { handleError } = require('../../utils/responseHandler');

const getLiveDashboard = async (req, res) => {
  try {
    const stats = await liveService.getLiveDashboard();
    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, 'Error fetching live dashboard', err);
  }
};

const getLiveVehicles = async (req, res) => {
  try {
    const { organization, fleetOwner, fleetUid, status, alertFilter, search } = req.query;
    const vehicles = await liveService.getLiveVehicles({
      organization,
      fleetOwner,
      fleetUid,
      status,
      alertFilter,
      search,
    });
    res.json({ success: true, data: vehicles });
  } catch (err) {
    handleError(res, 'Error fetching live vehicles', err);
  }
};

const getLiveVehicleDetail = async (req, res) => {
  try {
    const { id } = req.params; // Using vehicle plate as ID
    const vehicle = await liveService.getLiveVehicleDetail(id);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: 'Vehicle not found' });
    }
    res.json({ success: true, data: vehicle });
  } catch (err) {
    handleError(res, 'Error fetching live vehicle detail', err);
  }
};

const getLiveAlerts = async (req, res) => {
  try {
    const alerts = await liveService.getLiveAlerts();
    res.json({ success: true, data: alerts });
  } catch (err) {
    handleError(res, 'Error fetching live alerts', err);
  }
};

const getLiveStatistics = async (req, res) => {
  try {
    const stats = await liveService.getLiveStatistics();
    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, 'Error fetching live statistics', err);
  }
};

const getLiveFleetList = async (req, res) => {
  try {
    const fleets = await liveService.getLiveFleetList();
    res.json({ success: true, data: fleets });
  } catch (err) {
    handleError(res, 'Error fetching live fleet list', err);
  }
};

module.exports = {
  getLiveDashboard,
  getLiveVehicles,
  getLiveVehicleDetail,
  getLiveAlerts,
  getLiveStatistics,
  getLiveFleetList,
};
