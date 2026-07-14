const supportService = require('../modules/admin/support.service');
const { handleError } = require('../utils/responseHandler');

const getMyTickets = async (req, res) => {
  try {
    const { status, priority, category } = req.query;
    // Fleet owner only gets their own tickets
    const tickets = await supportService.getAllTickets({ status, priority, category, uid: req.user.uid });
    res.json({ success: true, data: tickets, total: tickets.length });
  } catch (err) {
    handleError(res, 'Error fetching tickets', err);
  }
};

const getMyTicketDetail = async (req, res) => {
  try {
    const ticket = await supportService.getTicketDetail(req.params.ticketNumber);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    res.json({ success: true, data: ticket });
  } catch (err) {
    handleError(res, 'Error fetching ticket detail', err);
  }
};

const createTicket = async (req, res) => {
  try {
    const { category, subject, description, priority } = req.body;
    const uid = req.user.uid;
    if (!category || !subject || !description) {
      return res.status(400).json({ error: 'category, subject and description are required' });
    }
    const ticket = await supportService.createTicket(uid, category, subject, description, priority || 'Medium');
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    handleError(res, 'Error creating ticket', err);
  }
};

const addMessage = async (req, res) => {
  try {
    const { message, attachments } = req.body;
    const senderId = req.user.uid;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    
    // Verify ticket ownership
    const ticket = await supportService.getTicketDetail(req.params.ticketNumber);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (ticket.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });

    const msg = await supportService.addMessage(req.params.ticketNumber, senderId, message, attachments || []);
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    handleError(res, 'Error adding message', err);
  }
};

module.exports = {
  getMyTickets,
  getMyTicketDetail,
  createTicket,
  addMessage
};
