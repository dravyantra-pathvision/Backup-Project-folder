const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { pool } = require('../config/dbconfig');
const reportService = require('../modules/admin/reports.service');
const path = require('path');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendReportEmail = async (recipients, reportPath, reportType) => {
  if (!process.env.SMTP_USER) {
    console.log('Skipping email delivery: SMTP not configured');
    return;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'DravYantra Reports <reports@dravyantra.com>',
    to: recipients.join(', '),
    subject: `Automated Report: ${reportType}`,
    text: `Please find attached the latest automated ${reportType}.`,
    attachments: [
      {
        filename: path.basename(reportPath),
        path: reportPath,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

const runScheduledReports = async () => {
  console.log('Running scheduled reports check...', new Date().toISOString());
  try {
    const res = await pool.query(`SELECT * FROM scheduled_reports WHERE is_active = true AND next_run_at <= NOW()`);
    
    for (const schedule of res.rows) {
      console.log(`Executing scheduled report ID ${schedule.id} (${schedule.report_type})`);
      try {
        const report = await reportService.generateReport(
          schedule.admin_uid,
          schedule.report_type,
          schedule.filters,
          schedule.format
        );
        
        const reportPath = path.join(__dirname, '..', report.file_url);
        
        await sendReportEmail(schedule.email_recipients, reportPath, schedule.report_type);

        // Update next_run_at
        let nextRun = new Date();
        if (schedule.schedule_type === 'Daily') nextRun.setDate(nextRun.getDate() + 1);
        else if (schedule.schedule_type === 'Weekly') nextRun.setDate(nextRun.getDate() + 7);
        else if (schedule.schedule_type === 'Monthly') nextRun.setMonth(nextRun.getMonth() + 1);

        await pool.query(`UPDATE scheduled_reports SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2`, [nextRun, schedule.id]);
        
        console.log(`Successfully completed and emailed scheduled report ID ${schedule.id}`);
      } catch (err) {
        console.error(`Failed to execute schedule ID ${schedule.id}:`, err);
      }
    }
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
  }
};

const startScheduler = () => {
  // Run every hour to check for due reports
  cron.schedule('0 * * * *', () => {
    runScheduledReports();
  });
  console.log('Report Scheduler started');
};

module.exports = { startScheduler };
