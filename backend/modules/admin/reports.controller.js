const reportService = require('./reports.service');

const generateReport = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const { reportType, filters, format } = req.body;
    
    if (!reportType || !format) {
      return res.status(400).json({ error: 'reportType and format are required' });
    }

    const report = await reportService.generateReport(adminUid, reportType, filters || {}, format);
    res.json({ success: true, report });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report', details: error.message });
  }
};

const getReportHistory = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const history = await reportService.getReportHistory(adminUid);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report history' });
  }
};

const deleteReport = async (req, res) => {
  try {
    await reportService.deleteReport(req.params.id);
    res.json({ success: true, message: 'Report deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report' });
  }
};

const scheduleReport = async (req, res) => {
  try {
    const adminUid = req.user.uid;
    const { reportType, filters, format, scheduleType, emailRecipients } = req.body;
    
    if (!reportType || !format || !scheduleType || !emailRecipients || emailRecipients.length === 0) {
      return res.status(400).json({ error: 'Missing required scheduling fields' });
    }

    const schedule = await reportService.scheduleReport(adminUid, reportType, filters || {}, format, scheduleType, emailRecipients);
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ error: 'Failed to schedule report' });
  }
};

const getScheduledReports = async (req, res) => {
  try {
    const schedules = await reportService.getScheduledReports();
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    await reportService.deleteSchedule(req.params.id);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
};

module.exports = {
  generateReport,
  getReportHistory,
  deleteReport,
  scheduleReport,
  getScheduledReports,
  deleteSchedule
};
