// routes/onboardingRoutes.js
const router = require('express').Router();
const onboardingController = require('../modules/onboarding/onboarding.controller');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/status', verifyToken, onboardingController.getStatus);
router.put('/step/:stepId', verifyToken, onboardingController.updateStep);
router.post('/submit', verifyToken, onboardingController.submitForApproval);

module.exports = router;
