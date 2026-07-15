// services/vehicleLifetimeEngine.js
// Accumulates completed trip stats into vehicle_lifetime_stats.
// Only called by tripCompletionService — never by live telemetry.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * UPSERT vehicle lifetime stats for a newly completed trip.
 *
 * @param {object} trip Completed trip row (fully frozen)
 * @param {string} uid  Organization UID
 */
async function accumulate(trip, uid) {
  try {
    const plate = trip.vehicle;
    if (!plate) return;

    const distance      = Number(trip.distance              || 0);
    const fuelUsed      = Number(trip.fuel_used             || 0);
    const idleSec       = Number(trip.total_idle_time       || 0);
    const runningSec    = Number(trip.running_time_seconds  || 0);
    const movingSec     = Number(trip.moving_time_seconds   || 0);
    const co2           = Number(trip.co2_emitted           || 0);
    const overspeed     = Number(trip.overspeed_events      || 0);
    const harshBraking  = Number(trip.harsh_braking_events || 0);
    const alertCount    = Number(trip.alert_count           || 0);
    const refillCount   = Number(trip.fuel_refill_count     || 0);
    const tripScore     = Number(trip.trip_score            || 100);
    const engineHours   = runningSec / 3600;

    await pool.query(
      `INSERT INTO vehicle_lifetime_stats
         (plate, uid,
          total_distance_km, total_fuel_consumed_l,
          total_trips, total_completed_trips,
          lifetime_idle_seconds, lifetime_running_seconds, lifetime_moving_seconds,
          lifetime_co2_kg,
          total_overspeed_events, total_harsh_braking, total_alert_count,
          fuel_refill_count,
          avg_trip_score, engine_hours,
          created_at, updated_at)
       VALUES ($1,$2,$3,$4,1,1,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
       ON CONFLICT (plate) DO UPDATE SET
         total_distance_km        = vehicle_lifetime_stats.total_distance_km        + $3,
         total_fuel_consumed_l    = vehicle_lifetime_stats.total_fuel_consumed_l    + $4,
         total_trips              = vehicle_lifetime_stats.total_trips              + 1,
         total_completed_trips    = vehicle_lifetime_stats.total_completed_trips    + 1,
         lifetime_idle_seconds    = vehicle_lifetime_stats.lifetime_idle_seconds    + $5,
         lifetime_running_seconds = vehicle_lifetime_stats.lifetime_running_seconds + $6,
         lifetime_moving_seconds  = vehicle_lifetime_stats.lifetime_moving_seconds  + $7,
         lifetime_co2_kg          = vehicle_lifetime_stats.lifetime_co2_kg          + $8,
         total_overspeed_events   = vehicle_lifetime_stats.total_overspeed_events   + $9,
         total_harsh_braking      = vehicle_lifetime_stats.total_harsh_braking      + $10,
         total_alert_count        = vehicle_lifetime_stats.total_alert_count        + $11,
         fuel_refill_count        = vehicle_lifetime_stats.fuel_refill_count        + $12,
         avg_trip_score           = (
           vehicle_lifetime_stats.avg_trip_score * vehicle_lifetime_stats.total_completed_trips + $13
         ) / (vehicle_lifetime_stats.total_completed_trips + 1),
         engine_hours             = vehicle_lifetime_stats.engine_hours             + $14,
         updated_at               = NOW()`,
      [
        plate, uid,
        distance, fuelUsed,
        idleSec, runningSec, movingSec,
        co2,
        overspeed, harshBraking, alertCount,
        refillCount,
        tripScore, engineHours,
      ]
    );

    console.log(`[Vehicle Lifetime Engine] Accumulated trip ${trip.id} → ${plate}`);
  } catch (e) {
    console.error('[Vehicle Lifetime Engine] accumulate failed:', e.message);
  }
}

module.exports = { accumulate };
