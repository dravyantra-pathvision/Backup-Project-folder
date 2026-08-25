// scratch/recalculate_all_trips.js
const { pool } = require('../config/dbconfig');
const driverScoreService = require('../services/driverScoreService');

async function recalculateAllTrips() {
  const client = await pool.connect();
  try {
    console.log('====================================================');
    console.log('🔄 Recalculating All Trips & Driver Scores (Company Defaults)');
    console.log('====================================================\n');

    // 1. Touch all trips to force BEFORE UPDATE trigger compute_trip_metrics to re-run
    await client.query(`
      UPDATE trips SET updated_at = NOW()
    `);
    console.log('✅ Trigger compute_trip_metrics re-evaluated for all trips');

    // 2. Fetch all completed trips and update driver scores
    const tripsRes = await client.query(`
      SELECT DISTINCT driver, uid FROM trips WHERE driver IS NOT NULL AND uid IS NOT NULL
    `);

    for (const row of tripsRes.rows) {
      console.log(`👤 Recalculating Driver Score for: ${row.driver}`);
      await driverScoreService.recalculate(row.driver, row.uid);
    }

    console.log('\n====================================================');
    console.log('📊 Recalculated Trips Table Snapshot:');
    console.log('====================================================');

    const res = await client.query(`
      SELECT id, vehicle, driver, distance, fuel_used, current_mileage, 
             fuel_wasted, money_wasted, total_idle_time, idle_money_wasted,
             overspeed_events, harsh_braking_events, trip_score, status
      FROM trips
      ORDER BY id ASC
    `);

    console.table(res.rows);

    const driversRes = await client.query(`SELECT id, name, vehicle, score, status FROM drivers ORDER BY created_at DESC`);
    console.log('\n=== UPDATED DRIVERS IN DB ===');
    console.table(driversRes.rows);

    console.log('====================================================');
    console.log('✅ Recalculation completed!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Recalculation error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

recalculateAllTrips();
