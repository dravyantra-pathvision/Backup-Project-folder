const { pool } = require('./config/dbconfig');

async function checkComplianceAlerts() {
  try {
    const now = new Date();
    
    // Check vehicles
    const vRes = await pool.query('SELECT plate, uid, next_service, insurance, permit, puc FROM vehicles');
    for (const v of vRes.rows) {
      const docs = [
        { name: 'Insurance', dateStr: v.insurance },
        { name: 'PUC', dateStr: v.puc },
        { name: 'Permit', dateStr: v.permit },
        { name: 'Service Due', dateStr: v.next_service }
      ];
      
      for (const doc of docs) {
        if (!doc.dateStr) continue;
        let date;
        if (doc.dateStr.includes('/')) {
          const parts = doc.dateStr.split('/');
          date = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          date = new Date(doc.dateStr);
        }
        
        if (isNaN(date.getTime())) continue;
        
        const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 15 && diffDays >= -30) { // expiring soon or recently expired
          // Check if an alert already exists for this document and vehicle recently
          const existing = await pool.query(
            `SELECT id FROM alerts WHERE uid=$1 AND vehicle_plate=$2 AND type='compliance' AND message LIKE $3 AND detected_at >= NOW() - INTERVAL '10 days'`,
            [v.uid, v.plate, `%${doc.name}%`]
          );
          if (existing.rowCount === 0) {
            await pool.query(
              `INSERT INTO alerts (uid, vehicle_plate, type, message, severity, category, status)
               VALUES ($1, $2, 'compliance', $3, 'warning', 'system', 'pending')`,
              [v.uid, v.plate, `${doc.name} is expiring in ${diffDays} days`]
            );
            console.log(`[Compliance] Generated alert for ${v.plate} - ${doc.name}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Compliance] Error checking compliance:', err);
  }
}

async function runSchedules() {
  try {
    const res = await pool.query(`SELECT * FROM report_schedules WHERE is_active = TRUE`);
    const schedules = res.rows;
    if (schedules.length === 0) return;

    console.log(`[Scheduler] Found ${schedules.length} active schedule(s). Processing...`);
    
    for (const schedule of schedules) {
      const channel = schedule.channel.toLowerCase();
      const report = schedule.report_type;
      const recipient = schedule.recipient || 'unknown recipient';

      // Simulate generating the CSV and sending it to the selected channel
      if (channel === 'whatsapp') {
        console.log(`✅ [WhatsApp API] Sending ${report} report to ${recipient} via WhatsApp...`);
      } else if (channel === 'email') {
        console.log(`📧 [Email API] Sending ${report} report to ${recipient} via Email...`);
      } else {
        console.log(`📱 [SMS API] Sending ${report} report to ${recipient} via SMS...`);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error running schedules:', err);
  }
}

// Run every 2 minutes
setInterval(() => {
  runSchedules();
  checkComplianceAlerts();
}, 120000);

// Run once on startup
checkComplianceAlerts();

console.log('[Scheduler] Report scheduler started. Monitoring active schedules and compliance...');

