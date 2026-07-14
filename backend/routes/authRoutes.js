const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/send-verification
router.post('/send-verification', authController.sendVerificationEmail);

module.exports = router;
