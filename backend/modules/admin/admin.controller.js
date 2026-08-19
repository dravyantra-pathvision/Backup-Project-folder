// modules/admin/admin.controller.js
// Handles HTTP request/response for all /api/admin/* endpoints.
// Business logic lives in admin.service.js.

const adminService = require('./admin.service');
const { handleError } = require('../../utils/responseHandler');
const { logAuditEvent } = require('../../utils/auditLogger');

// ── Dashboard ─────────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const stats = await adminService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    handleError(res, 'Error fetching admin dashboard', err);
  }
};


// ── Fleet Owners ──────────────────────────────────────────────────────────────
const getAllFleetOwners = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, orgStatus } = req.query;
    const data = await adminService.getAllFleetOwners({ page: Number(page), limit: Number(limit), search, status, orgStatus });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching fleet owners', err);
  }
};

const getFleetOwnerDetail = async (req, res) => {
  try {
    const data = await adminService.getFleetOwnerDetail(req.params.uid);
    if (!data) return res.status(404).json({ error: 'Fleet Owner not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching fleet owner detail', err);
  }
};

const updateFleetOwner = async (req, res) => {
  try {
    const data = await adminService.updateFleetOwner(req.params.uid, req.body);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Fleet Owner',
      action: 'Updated',
      newValue: req.body
    }, req);
    res.json({ success: true, message: 'Fleet Owner updated', data });
  } catch (err) {
    handleError(res, 'Error updating fleet owner', err);
  }
};

const updateFleetOwnerStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const data = await adminService.updateFleetOwnerStatus(req.params.uid, status, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Fleet Owner',
      action: `Status: ${status}`,
      newValue: { status }
    }, req);
    res.json({ success: true, message: `Fleet Owner status updated to ${status}`, data });
  } catch (err) {
    handleError(res, 'Error updating fleet owner status', err);
  }
};

const deleteFleetOwner = async (req, res) => {
  try {
    if (req.query.permanent === 'true' || req.body?.permanent === true) {
      await adminService.hardDeleteFleetOwner(req.params.uid, req.user.uid);
      await logAuditEvent({
        userUid: req.user.uid,
        module: 'Fleet Owner',
        action: 'Permanently Deleted',
        newValue: { uid: req.params.uid }
      }, req);
      return res.json({ success: true, message: 'Fleet Owner permanently deleted' });
    }

    await adminService.deleteFleetOwner(req.params.uid, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Fleet Owner',
      action: 'Deleted',
      newValue: { uid: req.params.uid }
    }, req);
    res.json({ success: true, message: 'Fleet Owner soft deleted successfully' });
  } catch (err) {
    handleError(res, 'Error deleting fleet owner', err);
  }
};

const deleteFleetOwnerPermanent = async (req, res) => {
  try {
    await adminService.hardDeleteFleetOwner(req.params.uid, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Fleet Owner',
      action: 'Permanently Deleted',
      newValue: { uid: req.params.uid }
    }, req);
    res.json({ success: true, message: 'Fleet Owner permanently deleted' });
  } catch (err) {
    handleError(res, 'Error permanently deleting fleet owner', err);
  }
};

const resetFleetOwnerPassword = async (req, res) => {
  try {
    const link = await adminService.resetFleetOwnerPassword(req.params.uid);
    res.json({ success: true, message: 'Password reset email initiated successfully', link });
  } catch (err) {
    handleError(res, 'Error resetting password', err);
  }
};

// ── Organizations ─────────────────────────────────────────────────────────────
const getAllOrganizations = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const data = await adminService.getAllOrganizations({ page: Number(page), limit: Number(limit), search, status });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching organizations', err);
  }
};

const getOrganizationDetail = async (req, res) => {
  try {
    const data = await adminService.getOrganizationDetail(req.params.uid);
    if (!data) return res.status(404).json({ error: 'Organization not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching organization detail', err);
  }
};

const updateOrganizationStatus = async (req, res, status) => {
  try {
    const { reason } = req.body;
    const data = await adminService.updateOrganizationStatus(req.params.id, status, reason, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: req.params.id, // using org_uid
      module: 'Organization',
      action: `Status: ${status}`,
      newValue: { status, reason }
    }, req);
    res.json({ success: true, message: `Organization ${status}`, data });
  } catch (err) {
    handleError(res, `Error updating organization to ${status}`, err);
  }
};

const approveOrganization = (req, res) => updateOrganizationStatus(req, res, 'Approved');
const rejectOrganization = (req, res) => updateOrganizationStatus(req, res, 'Rejected');
const suspendOrganization = (req, res) => updateOrganizationStatus(req, res, 'Suspended');
const reactivateOrganization = (req, res) => updateOrganizationStatus(req, res, 'Approved');

const deleteOrganizationPermanent = async (req, res) => {
  try {
    await adminService.hardDeleteOrganization(req.params.id, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Organization',
      action: 'Permanently Deleted',
      newValue: { id: req.params.id }
    }, req);
    res.json({ success: true, message: 'Organization permanently deleted' });
  } catch (err) {
    handleError(res, 'Error permanently deleting organization', err);
  }
};

// Support ?permanent=true query param as well
const deleteOrganization = async (req, res) => {
  if (req.query.permanent === 'true') {
    return deleteOrganizationPermanent(req, res);
  }
  res.status(400).json({ error: 'Use ?permanent=true to delete an organization permanently' });
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
// Vehicle management has been moved to vehicles.controller.js and vehicles.service.js

// ── Drivers ───────────────────────────────────────────────────────────────────
const getAllDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const data = await adminService.getAllDrivers({ page: Number(page), limit: Number(limit), search });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching drivers', err);
  }
};

// ── Trips (Migrated to trips.controller.js) ───────────────────────────────────
// ── Alerts ────────────────────────────────────────────────────────────────────
const getAllAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;
    const data = await adminService.getAllAlerts({ page: Number(page), limit: Number(limit), type });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching alerts', err);
  }
};

// ── Reports ───────────────────────────────────────────────────────────────────
const getReports = async (req, res) => {
  try {
    const data = await adminService.getReports(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching reports', err);
  }
};

// ── Analytics ─────────────────────────────────────────────────────────────────
const getAnalytics = async (req, res) => {
  try {
    const data = await adminService.getAnalytics(req.query);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching analytics', err);
  }
};

// ── Settings ──────────────────────────────────────────────────────────────────
const getSettings = async (req, res) => {
  try {
    const data = await adminService.getSettings();
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching settings', err);
  }
};

const updateSettings = async (req, res) => {
  try {
    const data = await adminService.updateSettings(req.body);
    res.json({ success: true, message: 'Settings updated', data });
  } catch (err) {
    handleError(res, 'Error updating settings', err);
  }
};

// ── Activity Logs ─────────────────────────────────────────────────────────────
const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const data = await adminService.getActivityLogs({ page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching activity logs', err);
  }
};

module.exports = {
  getDashboard,
  getAllFleetOwners,
  getFleetOwnerDetail,
  updateFleetOwner,
  updateFleetOwnerStatus,
  deleteFleetOwner,
  deleteFleetOwnerPermanent,
  resetFleetOwnerPassword,
  getAllOrganizations,
  getOrganizationDetail,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  reactivateOrganization,
  deleteOrganization,
  deleteOrganizationPermanent,
  getAllDrivers,
  getAllAlerts,
  getReports,
  getAnalytics,
  getSettings,
  updateSettings,
  getActivityLogs,
};
