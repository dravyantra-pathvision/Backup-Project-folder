// d:\DY\backend\scratch\complete_sim_trips.js
const { pool } = require('../config/dbconfig');
const tripCompletionService = require('../services/tripCompletionService');

async function completeAllActiveTrips() {
  const client = await pool.connect();
  try {
    console.log('====================================================');
    console.log('⚡ Completing Active Trips & Triggering Score Recalculation');
    console.log('====================================================');

    const activeTripsRes = await client.query(
      `SELECT id, uid, vehicle, driver, distance, live_speed, overspeed_events, harsh_braking_events, rapid_accel_events 
       FROM trips 
       WHERE trip_completed IS NOT TRUE AND status != 'completed'`
    );

    console.log(`Found ${activeTripsRes.rows.length} active trip(s) to complete:\n`);

    for (const trip of activeTripsRes.rows) {
      console.log(`📌 Completing Trip: ${trip.id} | Driver: ${trip.driver} | Vehicle: ${trip.vehicle}`);
      console.log(`   Stats -> Dist: ${trip.distance} km | Overspeed: ${trip.overspeed_events || 0} | Harsh Braking: ${trip.harsh_braking_events || 0}`);
      
      // Run full completion pipeline
      await tripCompletionService.onTripCompleted(trip.id, trip.uid);
    }

    console.log('\n====================================================');
    console.log('📊 Updated Drivers Performance Scores:');
    console.log('====================================================');

    const driversRes = await client.query(
      `SELECT id, name, vehicle, status, score FROM drivers ORDER BY created_at DESC`
    );

    for (const d of driversRes.rows) {
      console.log(`👤 Driver: ${d.name} (${d.id}) | Vehicle: ${d.vehicle} | Status: ${d.status} | Updated Score: ${d.score}`);
    }

    console.log('====================================================');
    console.log('✅ All trips completed successfully and scores recalculated!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ Error completing trips:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

completeAllActiveTrips();
