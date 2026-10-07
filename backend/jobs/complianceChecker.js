const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { pool } = require('../config/dbconfig');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendAlertEmail = async (email, subject, text) => {
  if (!process.env.SMTP_USER) {
    console.log('Skipping email delivery: SMTP not configured');
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'DravYantra Alerts <alerts@dravyantra.com>',
      to: email,
      subject: subject,
      text: text,
    });
  } catch (err) {
    console.error('Failed to send compliance email:', err);
  }
};

const checkComplianceAlerts = async () => {
  console.log('[ComplianceChecker] Running compliance checks...', new Date().toISOString());
  try {
    const now = new Date();
    // Midnight today for exact diff calculation
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Check vehicles
    const vRes = await pool.query('SELECT plate, uid, next_service FROM vehicles');
    const dRes = await pool.query('SELECT name, uid, lic_exp FROM drivers');

    const checkDocument = async (uid, reference, docName, dateStr) => {
      if (!dateStr || dateStr === 'UNKNOWN' || dateStr.trim() === '') return;
      let date;
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          date = new Date(parts[2], parts[1] - 1, parts[0]);
        }
      } else {
        date = new Date(dateStr);
      }
      
      if (!date || isNaN(date.getTime())) return;
      
      const docDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const diffDays = Math.floor((docDate - today) / (1000 * 60 * 60 * 24));

      // Trigger if exactly 30, 23, 16, 9, 2 days, or daily if <= 0
      const shouldTrigger = [30, 23, 16, 9, 2].includes(diffDays) || diffDays <= 0;

      if (shouldTrigger) {
        // Prevent duplicate alerts in the database for today
        const existing = await pool.query(
          `SELECT id FROM alerts WHERE uid=$1 AND vehicle_plate=$2 AND type='compliance' AND message LIKE $3 AND detected_at >= CURRENT_DATE`,
          [uid, reference, `%${docName}%`]
        );

        if (existing.rowCount === 0) {
          const statusMsg = diffDays > 0 ? `expiring in ${diffDays} days` : `expired`;
          const msg = `${docName} is ${statusMsg}`;
          const sev = diffDays <= 15 ? 'danger' : 'warning';
          
          await pool.query(
            `INSERT INTO alerts (uid, vehicle_plate, type, message, severity, category, status, detected_at)
             VALUES ($1, $2, 'compliance', $3, $4, 'system', 'pending', NOW())`,
            [uid, reference, msg, sev]
          );
          console.log(`[Compliance] Generated alert for ${reference} - ${msg}`);

          // Email owner if email_notif is true
          const uRes = await pool.query(`SELECT email, email_notif FROM users WHERE uid = $1`, [uid]);
          if (uRes.rowCount > 0 && uRes.rows[0].email_notif) {
            const email = uRes.rows[0].email;
            const text = `Compliance Alert for ${reference}:\n\nYour ${docName} is ${statusMsg}.\nPlease renew it and upload the updated document and date in the app to dismiss this alert.\n\nThank you,\nDravYantra Team`;
            await sendAlertEmail(email, `Compliance Alert: ${reference} ${docName}`, text);
          }
        }
      }
    };

    // Vehicles
    for (const v of vRes.rows) {
      await checkDocument(v.uid, v.plate, 'Service Due', v.next_service);
    }

    // Drivers
    for (const d of dRes.rows) {
      await checkDocument(d.uid, d.name, 'Driving License', d.lic_exp);
    }

  } catch (err) {
    console.error('[ComplianceChecker] Error checking compliance:', err);
  }
};

const startComplianceScheduler = () => {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', () => {
    checkComplianceAlerts();
  });
  console.log('Compliance Scheduler started');
};

module.exports = { startComplianceScheduler, checkComplianceAlerts };
