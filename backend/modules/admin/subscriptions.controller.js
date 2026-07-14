// modules/admin/subscriptions.controller.js
// HTTP handlers for subscription & billing management endpoints.

const subscriptionService = require('./subscriptions.service');
const { handleError } = require('../../utils/responseHandler');
const { logAuditEvent } = require('../../utils/auditLogger');

// ── Dashboard ─────────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const data = await subscriptionService.getSubscriptionDashboard();
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching subscription dashboard', err);
  }
};

// ── Plans ─────────────────────────────────────────────────────────────────────
const getAllPlans = async (req, res) => {
  try {
    const data = await subscriptionService.getAllPlans();
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching plans', err);
  }
};

const getPlanById = async (req, res) => {
  try {
    const data = await subscriptionService.getPlanById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Plan not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching plan', err);
  }
};

const createPlan = async (req, res) => {
  try {
    const data = await subscriptionService.createPlan(req.body);
    res.status(201).json({ success: true, message: 'Plan created', data });
  } catch (err) {
    handleError(res, 'Error creating plan', err);
  }
};

const updatePlan = async (req, res) => {
  try {
    const data = await subscriptionService.updatePlan(req.params.id, req.body);
    res.json({ success: true, message: 'Plan updated', data });
  } catch (err) {
    handleError(res, 'Error updating plan', err);
  }
};

const deletePlan = async (req, res) => {
  try {
    await subscriptionService.deletePlan(req.params.id);
    res.json({ success: true, message: 'Plan deleted' });
  } catch (err) {
    if (err.message && err.message.includes('active subscriptions')) {
      return res.status(400).json({ error: err.message });
    }
    handleError(res, 'Error deleting plan', err);
  }
};

// ── Subscriptions ─────────────────────────────────────────────────────────────
const getAllSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, search } = req.query;
    const data = await subscriptionService.getAllSubscriptions({ page: Number(page), limit: Number(limit), status, search });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching subscriptions', err);
  }
};

const getSubscriptionByOrg = async (req, res) => {
  try {
    const data = await subscriptionService.getSubscriptionByOrg(req.params.uid);
    if (!data) return res.status(404).json({ error: 'Subscription not found for organization' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching org subscription', err);
  }
};

const assignPlan = async (req, res) => {
  try {
    const { orgUid, planId, notes } = req.body;
    if (!orgUid || !planId) return res.status(400).json({ error: 'orgUid and planId are required' });
    const data = await subscriptionService.assignPlan({ orgUid, planId, adminUid: req.user.uid, notes });
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: orgUid,
      module: 'Subscription',
      action: 'Plan Assigned',
      newValue: { planId, notes }
    }, req);
    res.status(201).json({ success: true, message: 'Plan assigned to organization', data });
  } catch (err) {
    handleError(res, 'Error assigning plan', err);
  }
};

const activateSubscription = async (req, res) => {
  try {
    const data = await subscriptionService.activateSubscription(req.params.id, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Subscription',
      action: 'Activated',
      newValue: { subscriptionId: req.params.id }
    }, req);
    res.json({ success: true, message: 'Subscription activated', data });
  } catch (err) {
    handleError(res, 'Error activating subscription', err);
  }
};

const suspendSubscription = async (req, res) => {
  try {
    const { reason } = req.body;
    const data = await subscriptionService.suspendSubscription(req.params.id, req.user.uid, reason);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Subscription',
      action: 'Suspended',
      newValue: { subscriptionId: req.params.id, reason }
    }, req);
    res.json({ success: true, message: 'Subscription suspended', data });
  } catch (err) {
    handleError(res, 'Error suspending subscription', err);
  }
};

const renewSubscription = async (req, res) => {
  try {
    const data = await subscriptionService.renewSubscription(req.params.id, req.user.uid);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Subscription',
      action: 'Renewed',
      newValue: { subscriptionId: req.params.id }
    }, req);
    res.json({ success: true, message: 'Subscription renewed', data });
  } catch (err) {
    handleError(res, 'Error renewing subscription', err);
  }
};

const extendTrial = async (req, res) => {
  try {
    const { extraDays = 7 } = req.body;
    const data = await subscriptionService.extendTrial(req.params.id, req.user.uid, Number(extraDays));
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Subscription',
      action: 'Trial Extended',
      newValue: { subscriptionId: req.params.id, extraDays }
    }, req);
    res.json({ success: true, message: `Trial extended by ${extraDays} days`, data });
  } catch (err) {
    handleError(res, 'Error extending trial', err);
  }
};

const cancelSubscription = async (req, res) => {
  try {
    const { reason } = req.body;
    const data = await subscriptionService.cancelSubscription(req.params.id, req.user.uid, reason);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Subscription',
      action: 'Cancelled',
      newValue: { subscriptionId: req.params.id, reason }
    }, req);
    res.json({ success: true, message: 'Subscription cancelled', data });
  } catch (err) {
    handleError(res, 'Error cancelling subscription', err);
  }
};

// ── Invoices ──────────────────────────────────────────────────────────────────
const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, orgUid } = req.query;
    const data = await subscriptionService.getAllInvoices({ page: Number(page), limit: Number(limit), status, orgUid });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching invoices', err);
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const data = await subscriptionService.getInvoiceById(req.params.id);
    if (!data) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, 'Error fetching invoice', err);
  }
};

const generateInvoice = async (req, res) => {
  try {
    const { orgUid, subscriptionId, notes } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId is required' });
    const data = await subscriptionService.generateInvoice({ orgUid, subscriptionId, adminUid: req.user.uid, notes });
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: orgUid,
      module: 'Billing',
      action: 'Invoice Generated',
      newValue: { subscriptionId, notes, invoiceId: data.id }
    }, req);
    res.status(201).json({ success: true, message: 'Invoice generated', data });
  } catch (err) {
    handleError(res, 'Error generating invoice', err);
  }
};

const markInvoicePaid = async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const data = await subscriptionService.markInvoicePaid(req.params.id, req.user.uid, paymentMethod);
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Billing',
      action: 'Invoice Paid',
      newValue: { invoiceId: req.params.id, paymentMethod }
    }, req);
    res.json({ success: true, message: 'Invoice marked as paid', data });
  } catch (err) {
    handleError(res, 'Error marking invoice paid', err);
  }
};

// ── Payments ──────────────────────────────────────────────────────────────────
const getPayments = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const data = await subscriptionService.getPayments({ page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching payments', err);
  }
};

module.exports = {
  getDashboard, getAllPlans, getPlanById, createPlan, updatePlan, deletePlan,
  getAllSubscriptions, getSubscriptionByOrg, assignPlan,
  activateSubscription, suspendSubscription, renewSubscription, extendTrial, cancelSubscription,
  getAllInvoices, getInvoiceById, generateInvoice, markInvoicePaid, getPayments,
};
