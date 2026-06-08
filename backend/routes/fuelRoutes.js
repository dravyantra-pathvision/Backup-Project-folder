// routes/fuelRoutes.js
const router = require('express').Router();
const fuelController = require('../controllers/fuelController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, fuelController.getFuelLogs);
router.post('/', verifyToken, fuelController.createFuelLog);

module.exports = router;
