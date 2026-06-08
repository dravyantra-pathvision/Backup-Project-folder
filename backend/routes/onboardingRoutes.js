// routes/onboardingRoutes.js
const router = require('express').Router();
const onboardingController = require('../controllers/onboardingController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, onboardingController.getOnboarding);
router.post('/', verifyToken, onboardingController.saveOnboarding);

module.exports = router;
