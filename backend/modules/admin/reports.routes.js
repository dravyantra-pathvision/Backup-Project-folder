const express = require('express');
const router = express.Router();
const reportsController = require('./reports.controller');

router.post('/generate', reportsController.generateReport);
router.get('/history', reportsController.getReportHistory);
router.delete('/history/:id', reportsController.deleteReport);

router.post('/schedule', reportsController.scheduleReport);
router.get('/schedule', reportsController.getScheduledReports);
router.delete('/schedule/:id', reportsController.deleteSchedule);

module.exports = router;
