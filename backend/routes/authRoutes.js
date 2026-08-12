const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/send-verification
router.post('/send-verification', authController.sendVerificationEmail);

// GET /api/auth/verify-email
router.get('/verify-email', authController.verifyEmailToken);

module.exports = router;
