const { pool } = require('../config/dbconfig');

async function resetMetrics() {
  try {
    console.log('🔄 Starting reset of fuel wasted and money wasted metrics...');

    // 1. Reset all trips to 0 distance, 0 idle time, etc. so the trigger automatically sets all wasted/saved metrics to 0
    await pool.query(`
      UPDATE trips 
      SET 
        distance = 0.0,
        fuel_used = 0.0,
        total_idle_time = 0,
        idle_duration = 0,
        idle_money_wasted = 0.0,
        fuel_wasted = 0.0,
        money_wasted = 0.0,
        speeding_fuel_wasted = 0.0,
        current_mileage = 3.5,
        fuel_saved = 0.0,
        money_saved = 0.0,
        theft_fuel_loss = 0.0,
        theft_money_loss = 0.0,
        live_speed = 0.0,
        power = false,
        live_idle_speed = 0.0,
        live_idle_time = '00:00:00',
        live_fuel_count = 0,
        progress = 0.0
    `);
    console.log('✅ Reset all records in trips table.');

    // 2. Reset vehicle lifetime stats
    await pool.query(`
      UPDATE vehicle_lifetime_stats
      SET
        total_distance_km = 0.0,
        total_fuel_consumed_l = 0.0,
        lifetime_idle_seconds = 0,
        lifetime_running_seconds = 0,
        lifetime_moving_seconds = 0,
        lifetime_co2_kg = 0.0,
        fuel_theft_count = 0,
        fuel_refill_count = 0,
        total_overspeed_events = 0,
        total_harsh_braking = 0,
        total_alert_count = 0,
        avg_trip_score = 100,
        vehicle_health_score = 100,
        engine_hours = 0.0
    `);
    console.log('✅ Reset vehicle_lifetime_stats table.');

    // 3. Clear telemetry history and events
    await pool.query('TRUNCATE TABLE telemetry_history RESTART IDENTITY CASCADE');
    console.log('✅ Truncated telemetry_history table.');

    await pool.query('TRUNCATE TABLE fuel_refill_events RESTART IDENTITY CASCADE');
    console.log('✅ Truncated fuel_refill_events table.');

    await pool.query('TRUNCATE TABLE fuel_theft_events RESTART IDENTITY CASCADE');
    console.log('✅ Truncated fuel_theft_events table.');

    // 4. Reset vehicle real-time stats
    await pool.query(`
      UPDATE vehicles
      SET
        mil = 0.0,
        idle = 0.0,
        speed = 0,
        fuel = 100.0,
        odo = 0.0,
        route = '[]'::jsonb
    `);
    console.log('✅ Reset vehicles table real-time stats.');

    // 5. Clear alerts
    await pool.query('TRUNCATE TABLE alerts RESTART IDENTITY CASCADE');
    console.log('✅ Truncated alerts table.');

    console.log('🎉 Database metrics reset complete!');
  } catch (error) {
    console.error('❌ Error resetting database metrics:', error);
  } finally {
    await pool.end();
  }
}

resetMetrics();
