// routes/fleetSettingsRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getFleetSettings, putFleetSettings } = require('../controllers/fleetSettingsController');

router.use(verifyToken);

router.get('/', getFleetSettings);
router.put('/', putFleetSettings);

module.exports = router;