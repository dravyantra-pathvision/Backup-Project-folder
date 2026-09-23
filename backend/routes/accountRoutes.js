// routes/accountRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const accountController = require('../controllers/accountController');

// All account routes require valid Firebase ID token authentication
router.post('/deletion-request', verifyToken, accountController.requestAccountDeletion);
router.get('/deletion-status', verifyToken, accountController.getDeletionStatus);

module.exports = router;
