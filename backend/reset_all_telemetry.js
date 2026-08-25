// d:\DY\backend\reset_all_telemetry.js
require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function resetAllTelemetryAndTrips() {
  const client = await pool.connect();
  try {
    console.log("====================================================");
    console.log("🔄 Comprehensive Database Reset: Clearing All Past Telemetry");
    console.log("====================================================\n");

    // 1. Reset all trips
    const tripRes = await client.query(`
      UPDATE trips 
      SET fuel_used = 0,
          fuel_wasted = 0,
          fuel_saved = 0,
          money_saved = 0,
          money_wasted = 0,
          idle_duration = 0,
          total_idle_time = 0,
          idle_money_wasted = 0,
          speeding_fuel_wasted = 0,
          theft_fuel_loss = 0,
          theft_money_loss = 0,
          distance = 0,
          progress = 0,
          live_speed = 0,
          overspeed_events = 0,
          harsh_braking_events = 0,
          rapid_accel_events = 0,
          alert_count = 0,
          trip_score = 100,
          power = true,
          status = 'in progress',
          trip_completed = false,
          start_time = NOW(),
          completed_at = NULL,
          frozen_at = NULL,
          updated_at = NOW()
    `);
    console.log(`✅ Reset ${tripRes.rowCount} trip record(s) to 0.`);

    // 2. Clear telemetry history
    try {
      await client.query(`TRUNCATE TABLE telemetry_history`);
      console.log("✅ Cleared telemetry_history table.");
    } catch (e) {
      console.warn("⚠️ Could not truncate telemetry_history:", e.message);
    }

    // 3. Clear alerts
    try {
      const alertRes = await client.query(`DELETE FROM alerts`);
      console.log(`✅ Cleared ${alertRes.rowCount} alert(s).`);
    } catch (e) {
      console.warn("⚠️ Could not clear alerts:", e.message);
    }

    // 4. Clear theft & refill events
    try {
      await client.query(`DELETE FROM fuel_theft_events`);
      await client.query(`DELETE FROM fuel_refill_events`);
      console.log("✅ Cleared fuel_theft_events & fuel_refill_events tables.");
    } catch (e) {
      // Table might not exist
    }

    // 5. Reset vehicle live telemetry state (fuel = NULL so initial simulation packet sets baseline without jump)
    const vehRes = await client.query(`
      UPDATE vehicles 
      SET speed = 0, 
          idle = 0, 
          fuel = NULL,
          route = '[]'::jsonb, 
          status = 'in_transit',
          is_active = true,
          updated_at = NOW()
    `);
    console.log(`✅ Reset ${vehRes.rowCount} vehicle telemetry state(s).`);

    // 6. Reset driver performance scores to 100
    const drvRes = await client.query(`
      UPDATE drivers 
      SET score = 100, status = 'Active', is_active = true
      WHERE is_deleted IS NOT TRUE
    `);
    console.log(`✅ Reset ${drvRes.rowCount} driver score(s) to 100.`);

    console.log("\n====================================================");
    console.log("🎉 Database reset complete! Ready for fresh simulation.");
    console.log("====================================================");
  } catch (err) {
    console.error("❌ Error during database reset:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

resetAllTelemetryAndTrips();
