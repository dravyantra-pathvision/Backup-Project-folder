// routes/savingsWalletRoutes.js
'use strict';
const express = require('express');
const router = express.Router();
const savingsWalletController = require('../controllers/savingsWalletController');

router.get('/', savingsWalletController.getSavingsWallet);
router.all('/seed_baselines', savingsWalletController.seedBaselines);

module.exports = router;
