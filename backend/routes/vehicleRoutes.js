// routes/vehicleRoutes.js
const router = require('express').Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, vehicleController.getVehicles);
router.post('/', verifyToken, vehicleController.createVehicle);
router.put('/:plate', verifyToken, vehicleController.updateVehicle);
router.delete('/:plate', verifyToken, vehicleController.deleteVehicle);

module.exports = router;
