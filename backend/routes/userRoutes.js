// routes/userRoutes.js
const router = require('express').Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/authMiddleware');

const accountController = require('../controllers/accountController');

router.post('/sync', verifyToken, userController.syncUser);
router.get('/profile', verifyToken, userController.getProfileAndOrg);
router.put('/profile', verifyToken, userController.updateProfile);
router.put('/organization', verifyToken, userController.updateOrganization);
router.put('/prompted', verifyToken, userController.updateLastPromptedAt);

// Account deletion route aliases under /api/users
router.post('/delete-account', verifyToken, accountController.requestAccountDeletion);
router.post('/account/deletion-request', verifyToken, accountController.requestAccountDeletion);

module.exports = router;
