// scratch/inspect_db_trips.js
const { pool } = require('../config/dbconfig');

async function inspectTrips() {
  const res = await pool.query(`
    SELECT id, vehicle, driver, distance, fuel_used, fuel_wasted, money_wasted, 
           total_idle_time, idle_money_wasted, speeding_fuel_wasted, theft_fuel_loss, theft_money_loss,
           overspeed_events, harsh_braking_events, rapid_accel_events, trip_score, status, trip_completed
    FROM trips
  `);
  console.log('=== TRIPS IN DB ===');
  console.table(res.rows);

  const driversRes = await pool.query(`SELECT id, name, vehicle, score, status FROM drivers`);
  console.log('=== DRIVERS IN DB ===');
  console.table(driversRes.rows);

  const alertsRes = await pool.query(`SELECT id, trip_id, type, message, detected_at FROM alerts ORDER BY detected_at DESC LIMIT 20`);
  console.log('=== ALERTS IN DB ===');
  console.table(alertsRes.rows);

  process.exit(0);
}

inspectTrips();
