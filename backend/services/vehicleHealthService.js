// services/vehicleHealthService.js
// Vehicle Health Score Calculator.
// Score is updated after every completed trip using vehicle_lifetime_stats.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * Recalculate and persist vehicle health score after a completed trip.
 *
 * @param {string} plate Vehicle plate number
 * @param {string} uid   Organization UID
 */
async function recalculate(plate, uid) {
  try {
    if (!plate) return;

    const statsRes = await pool.query(
      'SELECT * FROM vehicle_lifetime_stats WHERE plate = $1 AND uid = $2',
      [plate, uid]
    );
    if (!statsRes.rows.length) return;

    const stats = statsRes.rows[0];
    let health = 100;

    // Theft events — most severe signal
    health -= Math.min(20, Number(stats.fuel_theft_count || 0) * 5);

    // Overspeed events (per 10 events)
    health -= Math.min(10, Math.floor(Number(stats.total_overspeed_events || 0) / 10) * 2);

    // Excessive idle ratio
    const totalRunning = Number(stats.lifetime_running_seconds || 1);
    const idleRatio    = Number(stats.lifetime_idle_seconds   || 0) / totalRunning;
    if (idleRatio > 0.5) health -= 3;

    // Gradual recovery: +1 per recent clean trip (max +5)
    const cleanTripsRes = await pool.query(
      `SELECT COUNT(*) AS cnt FROM trips
       WHERE vehicle = $1 AND uid = $2
         AND trip_completed = TRUE
         AND overspeed_events = 0
         AND harsh_braking_events = 0
         AND alert_count = 0
       ORDER BY completed_at DESC LIMIT 5`,
      [plate, uid]
    );
    health += Math.min(5, Number(cleanTripsRes.rows[0]?.cnt || 0));

    health = Math.max(0, Math.min(100, Math.round(health)));

    await pool.query(
      `UPDATE vehicle_lifetime_stats
         SET vehicle_health_score = $1, updated_at = NOW()
       WHERE plate = $2`,
      [health, plate]
    );

    console.log(`[Vehicle Health] ${plate} → ${health}`);
  } catch (e) {
    console.error('[Vehicle Health] recalculate failed:', e.message);
  }
}

module.exports = { recalculate };
