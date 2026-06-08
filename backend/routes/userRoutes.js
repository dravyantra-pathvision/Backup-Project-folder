// routes/userRoutes.js
const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/sync', verifyToken, userController.syncUser);

module.exports = router;
