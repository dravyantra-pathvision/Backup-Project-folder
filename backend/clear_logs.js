require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function clearLogs() {
  const client = await pool.connect();
  try {
    console.log("Truncating logs...");
    await client.query('TRUNCATE alerts, alert_audit_log, telemetry_history, fuel_refill_events, fuel_theft_events, fuel_logs, vehicle_lifetime_stats CASCADE');
    console.log("Logs cleared!");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}
clearLogs();
