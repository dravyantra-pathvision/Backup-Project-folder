const router = require('express').Router();
const supportController = require('../controllers/supportController');

router.get('/tickets', supportController.getMyTickets);
router.post('/tickets', supportController.createTicket);
router.get('/tickets/:ticketNumber', supportController.getMyTicketDetail);
router.post('/tickets/:ticketNumber/messages', supportController.addMessage);

module.exports = router;
