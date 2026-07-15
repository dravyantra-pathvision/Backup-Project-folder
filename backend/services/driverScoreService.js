// services/driverScoreService.js
// Driver Performance Score Calculator.
// Score is updated after every completed trip based on last 10 trips.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * Recalculate and persist driver score after a completed trip.
 *
 * @param {string} driverIdentifier  Driver name or ID
 * @param {string} uid               Organization UID
 */
async function recalculate(driverIdentifier, uid) {
  try {
    if (!driverIdentifier) return;

    // Load last 10 completed trips for this driver
    const tripsRes = await pool.query(
      `SELECT trip_score, overspeed_events, harsh_braking_events, rapid_accel_events,
              alert_count, total_idle_time
       FROM trips
       WHERE (driver = $1) AND uid = $2 AND trip_completed = TRUE
       ORDER BY completed_at DESC LIMIT 10`,
      [driverIdentifier, uid]
    );
    if (tripsRes.rows.length === 0) return;

    const recentTrips = tripsRes.rows;
    const deductions = recentTrips.map(trip => {
      let d = 0;
      d += Number(trip.overspeed_events    || 0) * 2;
      d += Number(trip.harsh_braking_events || 0) * 3;
      d += Number(trip.rapid_accel_events   || 0) * 2;
      d += Number(trip.alert_count          || 0) > 5 ? 5 : 0;
      if (Number(trip.total_idle_time || 0) > 1800) d += 5; // >30 min idle

      // Safe trip bonuses
      let bonus = 0;
      if (Number(trip.overspeed_events    || 0) === 0) bonus += 3;
      if (Number(trip.harsh_braking_events || 0) === 0) bonus += 2;
      return Math.max(0, d - bonus);
    });

    const avgDeduction = deductions.reduce((a, b) => a + b, 0) / deductions.length;
    const score = Math.max(0, Math.min(100, Math.round(100 - avgDeduction)));

    await pool.query(
      `UPDATE drivers SET score = $1 WHERE (name = $2 OR id = $2) AND uid = $3`,
      [score, driverIdentifier, uid]
    );

    console.log(`[Driver Score] ${driverIdentifier} → ${score}`);
  } catch (e) {
    console.error('[Driver Score] recalculate failed:', e.message);
  }
}

module.exports = { recalculate };
