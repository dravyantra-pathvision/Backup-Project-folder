const supportService = require('./support.service');
const { handleError } = require('../../utils/responseHandler');
const { logAuditEvent } = require('../../utils/auditLogger');

const getAllTickets = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    const tickets = await supportService.getAllTickets({ status, priority, category });
    res.json({ success: true, data: tickets, total: tickets.length });
  } catch (err) {
    handleError(res, 'Error fetching tickets', err);
  }
};

const getTicketDetail = async (req, res) => {
  try {
    const ticket = await supportService.getTicketDetail(req.params.ticketNumber);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    handleError(res, 'Error fetching ticket detail', err);
  }
};

const createTicket = async (req, res) => {
  try {
    const { uid, category, subject, description, priority } = req.body;
    if (!uid || !category || !subject || !description) {
      return res.status(400).json({ error: 'uid, category, subject and description are required' });
    }
    const ticket = await supportService.createTicket(uid, category, subject, description, priority);
    await logAuditEvent({
      userUid: req.user.uid,
      orgUid: uid,
      module: 'Support',
      action: 'Ticket Created',
      newValue: { ticketNumber: ticket.ticket_number, subject, category }
    }, req);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    handleError(res, 'Error creating ticket', err);
  }
};

const updateTicket = async (req, res) => {
  try {
    const { status, priority, assigned_staff_id } = req.body;
    const updated = await supportService.updateTicket(req.params.ticketNumber, { status, priority, assigned_staff_id });
    if (!updated) return res.status(404).json({ error: 'Ticket not found or no changes provided' });
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Support',
      action: 'Ticket Updated',
      newValue: { ticketNumber: req.params.ticketNumber, status, priority, assigned_staff_id }
    }, req);
    res.json({ success: true, data: updated });
  } catch (err) {
    handleError(res, 'Error updating ticket', err);
  }
};

const addMessage = async (req, res) => {
  try {
    const { message, attachments } = req.body;
    const senderId = req.user.uid;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const msg = await supportService.addMessage(req.params.ticketNumber, senderId, message, attachments || []);
    await logAuditEvent({
      userUid: senderId,
      module: 'Support',
      action: 'Message Added',
      newValue: { ticketNumber: req.params.ticketNumber }
    }, req);
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    handleError(res, 'Error adding message', err);
  }
};

const getAnalytics = async (req, res) => {
  try {
    const analytics = await supportService.getAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    handleError(res, 'Error fetching support analytics', err);
  }
};

module.exports = {
  getAllTickets,
  getTicketDetail,
  createTicket,
  updateTicket,
  addMessage,
  getAnalytics
};
