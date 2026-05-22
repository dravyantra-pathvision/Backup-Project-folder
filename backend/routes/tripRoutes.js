// routes/tripRoutes.js
const router = require('express').Router();
const tripController = require('../controllers/tripController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, tripController.getTrips);
router.get('/summary', verifyToken, tripController.getSummary);
router.post('/', verifyToken, tripController.createTrip);
router.put('/:id', verifyToken, tripController.updateTrip);
router.delete('/:id', verifyToken, tripController.deleteTrip);

module.exports = router;
