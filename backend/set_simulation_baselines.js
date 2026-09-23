require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function setBaselines() {
  const client = await pool.connect();
  try {
    console.log("====================================================");
    console.log("🛠️ Establishing Completed Baseline Records for Simulation");
    console.log("====================================================\n");

    const UID = process.env.FLEET_OWNER_UID || 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';

    const simVehicles = [
      { plate: 'KA 01 AB 1234', driver: 'Kartik', driverId: 'DRV-KARTIK-01' },
      { plate: 'KA 02 CD 5678', driver: 'Anand', driverId: 'DRV-ANAND-02' },
      { plate: 'KA 03 EF 9012', driver: 'Chakravarthi', driverId: 'DRV-CHAKRA-03' },
    ];

    const baselineDistance = 3000.0;
    const baselineFuel = 750.0;
    const baselineEfficiency = baselineDistance / baselineFuel; // 4.00 km/L
    const baselineIdleHours = 30.0;
    const baselineIdleFuel = 24.0;
    const baselineOverspeedEvents = 30;

    for (const v of simVehicles) {
      // Check if baseline already exists for this vehicle
      const existing = await client.query(
        `SELECT * FROM vehicle_baselines WHERE uid = $1 AND vehicle_id = $2`,
        [UID, v.plate]
      );

      if (existing.rows.length > 0) {
        // Update existing baseline record to completed status with exact specified values
        await client.query(`
          UPDATE vehicle_baselines
          SET baseline_start_date = NOW() - INTERVAL '30 days',
              baseline_end_date = NOW() - INTERVAL '1 day',
              baseline_duration_days = 30,
              baseline_distance = $1,
              baseline_fuel_consumed = $2,
              baseline_efficiency = $3,
              baseline_idle_hours = $4,
              baseline_idle_fuel = $5,
              baseline_overspeed_events = $6,
              baseline_status = 'completed',
              updated_at = NOW()
          WHERE uid = $7 AND vehicle_id = $8
        `, [
          baselineDistance,
          baselineFuel,
          baselineEfficiency,
          baselineIdleHours,
          baselineIdleFuel,
          baselineOverspeedEvents,
          UID,
          v.plate
        ]);
        console.log(`✅ Updated existing baseline record for Vehicle ${v.plate} (${v.driver}).`);
      } else {
        // Insert new completed baseline record
        await client.query(`
          INSERT INTO vehicle_baselines (
            uid, vehicle_id, baseline_start_date, baseline_end_date, baseline_duration_days,
            baseline_distance, baseline_fuel_consumed, baseline_efficiency,
            baseline_idle_hours, baseline_idle_fuel, baseline_overspeed_events,
            baseline_status, created_at, updated_at
          )
          VALUES (
            $1, $2, NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day', 30,
            $3, $4, $5,
            $6, $7, $8,
            'completed', NOW(), NOW()
          )
        `, [
          UID,
          v.plate,
          baselineDistance,
          baselineFuel,
          baselineEfficiency,
          baselineIdleHours,
          baselineIdleFuel,
          baselineOverspeedEvents
        ]);
        console.log(`✅ Inserted new completed baseline record for Vehicle ${v.plate} (${v.driver}).`);
      }
    }

    // Clean up extra baseline records for non-simulated vehicles if any exist so exact count is 3
    await client.query(
      `DELETE FROM vehicle_baselines WHERE uid = $1 AND vehicle_id NOT IN ('KA 01 AB 1234', 'KA 02 CD 5678', 'KA 03 EF 9012')`,
      [UID]
    );

    // Fetch and display final verified baseline records
    const finalBaselines = await client.query(
      `SELECT * FROM vehicle_baselines WHERE uid = $1 ORDER BY vehicle_id ASC`,
      [UID]
    );

    console.log("\n====================================================");
    console.log("📋 Verified Completed Baseline Records in Database:");
    console.log("====================================================");
    console.log(JSON.stringify(finalBaselines.rows, null, 2));

  } catch (err) {
    console.error("❌ Error setting baselines:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

setBaselines();
