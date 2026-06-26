// routes/userRoutes.js
const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/sync', verifyToken, userController.syncUser);
router.get('/profile', verifyToken, userController.getProfileAndOrg);
router.put('/profile', verifyToken, userController.updateProfile);
router.put('/organization', verifyToken, userController.updateOrganization);
router.put('/prompted', verifyToken, userController.updateLastPromptedAt);

module.exports = router;
