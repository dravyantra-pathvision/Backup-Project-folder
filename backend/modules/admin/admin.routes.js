// modules/admin/admin.routes.js
// All /api/admin/* routes — requires admin role on every endpoint.

const router = require('express').Router();
const { verifyAdminToken } = require('../../middleware/adminAuthMiddleware');
const { adminLogin } = require('../../controllers/adminAuthController');
const adminController = require('./admin.controller');
const devicesController = require('./devices.controller');
const liveController = require('./live.controller');
const vehiclesController = require('./vehicles.controller');
const driversController = require('./drivers.controller');
const tripsController = require('./trips.controller');
const alertsController = require('./alerts.controller');
const analyticsController = require('./analytics.controller');

// ── Authentication ────────────────────────────────────────────────────────────
// Unprotected route for logging in and getting the backend JWT
router.post('/login', adminLogin);

// Apply strict backend JWT auth + admin role check to ALL subsequent routes
router.use(verifyAdminToken);

// ── Profile (Logged-in Admin) ─────────────────────────────────────────────────
const profileRoutes = require('./profile.routes');
router.use('/profile', profileRoutes);

// ── Devices (IoT Management) ──────────────────────────────────────────────────
router.post('/devices', devicesController.registerDevice);
router.get('/devices', devicesController.getAllDevices);
router.get('/devices/:id', devicesController.getDeviceDetail);
router.put('/devices/:id', devicesController.updateDevice);
router.patch('/devices/:id/status', devicesController.updateDeviceStatus);
router.delete('/devices/:id', devicesController.deleteDevice);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard', adminController.getDashboard);

// ── Fleet Owners ──────────────────────────────────────────────────────────────
router.get('/fleetowners', adminController.getAllFleetOwners);
router.get('/fleetowners/:uid', adminController.getFleetOwnerDetail);
router.put('/fleetowners/:uid', adminController.updateFleetOwner);
router.patch('/fleetowners/:uid/status', adminController.updateFleetOwnerStatus);
router.post('/fleetowners/:uid/restore', adminController.restoreFleetOwner);
router.delete('/fleetowners/:uid/permanent', adminController.deleteFleetOwnerPermanent);
router.delete('/fleetowners/:uid', adminController.deleteFleetOwner);
router.post('/fleetowners/:uid/reset-password', adminController.resetFleetOwnerPassword);

// ── Organizations ─────────────────────────────────────────────────────────────
router.get('/organizations', adminController.getAllOrganizations);
router.get('/organizations/:uid', adminController.getOrganizationDetail);
router.post('/organizations/:id/approve', adminController.approveOrganization);
router.post('/organizations/:id/reject', adminController.rejectOrganization);
router.post('/organizations/:id/suspend', adminController.suspendOrganization);
router.post('/organizations/:id/reactivate', adminController.reactivateOrganization);
router.post('/organizations/:id/restore', adminController.restoreOrganization);
router.delete('/organizations/:id/permanent', adminController.deleteOrganizationPermanent);
router.delete('/organizations/:id', adminController.deleteOrganization);

// ── Live Monitoring ───────────────────────────────────────────────────────────
router.get('/live-dashboard', liveController.getLiveDashboard);
router.get('/live-vehicles', liveController.getLiveVehicles);
router.get('/live-vehicle/:id', liveController.getLiveVehicleDetail);
router.get('/live-alerts', liveController.getLiveAlerts);
router.get('/live-statistics', liveController.getLiveStatistics);
router.get('/live-fleet-list', liveController.getLiveFleetList);

// ── Vehicles ──────────────────────────────────────────────────────────────────
router.get('/vehicles', vehiclesController.getAllVehicles);
router.get('/vehicles/:id', vehiclesController.getVehicleDetail);
router.get('/vehicles/:id/logs', vehiclesController.getVehicleAuditLogs);
router.post('/vehicles/:id/block', vehiclesController.blockVehicle);
router.post('/vehicles/:id/suspend', vehiclesController.suspendVehicle);
router.post('/vehicles/:id/reactivate', vehiclesController.reactivateVehicle);
router.post('/vehicles/:id/restore', vehiclesController.restoreVehicle);
router.delete('/vehicles/:id/permanent', vehiclesController.deleteVehiclePermanent);
router.delete('/vehicles/:id', vehiclesController.deleteVehicle);

const reportsRoutes = require('./reports.routes');
router.use('/reports-center', reportsRoutes);

// ── Drivers ───────────────────────────────────────────────────────────────────

// ── Trips ─────────────────────────────────────────────────────────────────────
router.get('/trips', tripsController.getAllTrips);
router.get('/trips/export', tripsController.exportTrips);
router.get('/trips/:id/timeline', tripsController.getTripTimeline);
router.get('/trips/:id', tripsController.getTripById);
router.post('/trips/:id/restore', tripsController.restoreTrip);
router.delete('/trips/:id/permanent', tripsController.deleteTripPermanent);
router.delete('/trips/:id', tripsController.deleteTrip);

// ── Alerts & Incident Management ──────────────────────────────────────────────────────
router.get('/alerts/statistics', alertsController.getAlertStatistics);
router.get('/alerts/filter-options', alertsController.getAlertFilterOptions);
router.get('/alerts/:id', alertsController.getAlertById);
router.get('/alerts', alertsController.getAllAlerts);
router.patch('/alerts/:id/status', alertsController.updateAlertStatus);
router.post('/alerts/:id/comment', alertsController.addAlertComment);
router.post('/alerts/:id/notify', alertsController.notifyFleetOwner);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get('/reports', adminController.getReports);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/overview', analyticsController.getOverview);
router.get('/analytics/fuel', analyticsController.getFuelAnalytics);
router.get('/analytics/vehicles', analyticsController.getVehicleAnalytics);
router.get('/analytics/drivers', analyticsController.getDriverAnalytics);
router.get('/analytics/trips', analyticsController.getTripAnalytics);
router.get('/analytics/devices', analyticsController.getDeviceAnalytics);
router.get('/analytics/environment', analyticsController.getEnvironmentAnalytics);
router.get('/analytics/alerts', analyticsController.getAlertAnalytics);
router.get('/analytics/export', analyticsController.exportAnalytics);
router.get('/analytics', adminController.getAnalytics);

const settingsController = require('./settings.controller');

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings/history', settingsController.getSettingsHistory);
router.get('/settings/:key', settingsController.getSettingByKey);
router.put('/settings/:key', settingsController.updateSetting);
router.get('/settings', settingsController.getAllSettings);

// ── Support & Tickets ─────────────────────────────────────────────────────────
const supportController = require('./support.controller');
router.get('/support/analytics', supportController.getAnalytics);
router.get('/support/tickets', supportController.getAllTickets);
router.post('/support/tickets', supportController.createTicket);
router.get('/support/tickets/:ticketNumber', supportController.getTicketDetail);
router.patch('/support/tickets/:ticketNumber', supportController.updateTicket);
router.post('/support/tickets/:ticketNumber/messages', supportController.addMessage);

// ── Audit Logs & Activity Center ──────────────────────────────────────────────
const auditController = require('./audit.controller');
router.get('/audit-logs/export', auditController.exportSystemAuditLogs);
router.get('/audit-logs', auditController.getSystemAuditLogs);

// ── Drivers (Monitoring & Suspension) ─────────────────────────────────────────
router.get('/drivers', driversController.getAllDrivers);
router.get('/drivers/export', driversController.exportDrivers);
router.get('/drivers/:id', driversController.getDriverById);
router.put('/drivers/:id/status', driversController.updateDriverStatus);
router.post('/drivers/:id/restore', driversController.restoreDriver);
router.delete('/drivers/:id/permanent', driversController.deleteDriverPermanent);
router.delete('/drivers/:id', driversController.deleteDriver);

// ── Subscriptions & Billing ───────────────────────────────────────────────────
const subscriptionsController = require('./subscriptions.controller');
router.get('/subscriptions/dashboard', subscriptionsController.getDashboard);
router.get('/subscriptions/plans', subscriptionsController.getAllPlans);
router.post('/subscriptions/plans', subscriptionsController.createPlan);
router.put('/subscriptions/plans/:id', subscriptionsController.updatePlan);
router.delete('/subscriptions/plans/:id', subscriptionsController.deletePlan);
router.get('/subscriptions/invoices', subscriptionsController.getAllInvoices);
router.post('/subscriptions/invoices/generate', subscriptionsController.generateInvoice);
router.get('/subscriptions/invoices/:id', subscriptionsController.getInvoiceById);
router.post('/subscriptions/invoices/:id/pay', subscriptionsController.markInvoicePaid);
router.get('/subscriptions/payments', subscriptionsController.getPayments);
router.post('/subscriptions/assign', subscriptionsController.assignPlan);
router.get('/subscriptions/org/:uid', subscriptionsController.getSubscriptionByOrg);
router.post('/subscriptions/:id/activate', subscriptionsController.activateSubscription);
router.post('/subscriptions/:id/suspend', subscriptionsController.suspendSubscription);
router.post('/subscriptions/:id/renew', subscriptionsController.renewSubscription);
router.post('/subscriptions/:id/extend-trial', subscriptionsController.extendTrial);
router.post('/subscriptions/:id/cancel', subscriptionsController.cancelSubscription);
router.get('/subscriptions', subscriptionsController.getAllSubscriptions);

// ── Recycle Bin ───────────────────────────────────────────────────────────────
const recycleBinController = require('./recycle_bin.controller');
router.get('/recycle-bin', recycleBinController.getRecycledItems);
router.post('/recycle-bin/restore', recycleBinController.restoreItem);
router.delete('/recycle-bin/permanent', recycleBinController.hardDeleteItem);
router.post('/recycle-bin/permanent', recycleBinController.hardDeleteItem);
router.post('/recycle-bin/retry-firebase-cleanup', recycleBinController.retryFirebaseCleanup);

module.exports = router;

