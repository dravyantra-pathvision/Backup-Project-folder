// modules/admin/vehicles.controller.js
const vehiclesService = require('./vehicles.service');
const { handleError } = require('../../utils/responseHandler');

const getAllVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, type, fuelType, status, organization, fleetOwner } = req.query;
    const data = await vehiclesService.getAllVehicles({
      page: Number(page),
      limit: Number(limit),
      search,
      type,
      fuelType,
      status,
      organization,
      fleetOwner
    });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching vehicles', err);
  }
};

const getVehicleDetail = async (req, res) => {
  try {
    const data = await vehiclesService.getVehicleDetail(req.params.id);
    if (!data) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching vehicle detail', err);
  }
};

const getVehicleAuditLogs = async (req, res) => {
  try {
    const data = await vehiclesService.getVehicleAuditLogs(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching vehicle audit logs', err);
  }
};

const blockVehicle = async (req, res) => {
  try {
    const { reason, remarks } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    const data = await vehiclesService.blockVehicle(req.params.id, reason, remarks, req.user.uid);
    res.json({ success: true, message: 'Vehicle blocked successfully', data });
  } catch (err) {
    handleError(res, 'Error blocking vehicle', err);
  }
};

const suspendVehicle = async (req, res) => {
  try {
    const { reason, remarks } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    const data = await vehiclesService.suspendVehicle(req.params.id, reason, remarks, req.user.uid);
    res.json({ success: true, message: 'Vehicle suspended successfully', data });
  } catch (err) {
    handleError(res, 'Error suspending vehicle', err);
  }
};

const reactivateVehicle = async (req, res) => {
  try {
    const data = await vehiclesService.reactivateVehicle(req.params.id, req.user.uid);
    res.json({ success: true, message: 'Vehicle reactivated successfully', data });
  } catch (err) {
    handleError(res, 'Error reactivating vehicle', err);
  }
};

const deleteVehiclePermanent = async (req, res) => {
  try {
    await vehiclesService.deleteVehiclePermanent(req.params.id, req.user.uid);
    res.json({ success: true, message: 'Vehicle permanently deleted' });
  } catch (err) {
    handleError(res, 'Error permanently deleting vehicle', err);
  }
};

const deleteVehicle = async (req, res) => {
  if (req.query.permanent === 'true' || req.body?.permanent === true) {
    return deleteVehiclePermanent(req, res);
  }
  try {
    await vehiclesService.softDeleteVehicle(req.params.id, req.user?.uid);
    res.json({ success: true, message: 'Vehicle moved to Recycle Bin' });
  } catch (err) {
    handleError(res, 'Error moving vehicle to Recycle Bin', err);
  }
};

module.exports = {
  getAllVehicles,
  getVehicleDetail,
  getVehicleAuditLogs,
  blockVehicle,
  suspendVehicle,
  reactivateVehicle,
  deleteVehicle,
  deleteVehiclePermanent,
};
