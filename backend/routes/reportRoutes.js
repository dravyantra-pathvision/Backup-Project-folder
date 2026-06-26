// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { generateReport, getSchedules, createSchedule, deleteSchedule } = require('../controllers/reportController');

router.use(verifyToken);

router.get('/generate', generateReport);
router.get('/schedules', getSchedules);
router.post('/schedules', createSchedule);
router.delete('/schedules/:id', deleteSchedule);

module.exports = router;
