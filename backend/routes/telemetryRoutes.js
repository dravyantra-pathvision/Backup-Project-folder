// routes/telemetryRoutes.js
const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');

// POST /api/telemetry
// This endpoint does not require authentication because it is accessed by raw hardware endpoints.
// In a real production setup, we would use an API key or HMAC signature here.
router.post('/', telemetryController.ingestTelemetry);

module.exports = router;
