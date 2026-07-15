const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getLifetimeStats } = require('../controllers/vehicleLifetimeController');

router.use(verifyToken);

router.get('/:plate/lifetime', getLifetimeStats);

module.exports = router;
