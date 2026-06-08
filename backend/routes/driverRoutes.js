// routes/driverRoutes.js
const router = require('express').Router();
const driverController = require('../controllers/driverController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, driverController.getDrivers);
router.get('/assigned', verifyToken, driverController.getAssignedDrivers);
router.delete('/:id', verifyToken, driverController.deleteDriver);
router.post('/', verifyToken, driverController.createDriver);
router.put('/:id', verifyToken, driverController.updateDriver);

module.exports = router;
