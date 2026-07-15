// services/tripCalculationEngine.js
// LAYER 7 — Trip Calculation Engine
// Atomically updates all trip statistics from a processed telemetry event.
// Also stamps immutable trip baseline on the first packet of a running trip.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * Compute live trip score from accumulated safety events.
 */
function computeTripScore({ overspeedEvents, harshBrakingEvents, rapidAccelEvents, alertCount }) {
  let score = 100;
  score -= Number(overspeedEvents    || 0) * 2;
  score -= Number(harshBrakingEvents || 0) * 3;
  score -= Number(rapidAccelEvents   || 0) * 2;
  score -= Number(alertCount         || 0) > 5 ? 5 : 0;
  return Math.max(0, Math.min(100, score));
}

/**
 * Derive human-readable trip status from engine state.
 */
function deriveTripStatus(power, speed) {
  if (power === true && speed > 0)  return 'running';
  if (power === true && speed === 0) return 'idle';
  return 'halted';
}

/**
 * Update trip statistics atomically for one telemetry packet.
 *
 * @param {object} trip         Active trip row
 * @param {object} packet       Incoming telemetry packet
 * @param {object} gpsResult    From gpsEngine.calculate()
 * @param {object} fuelResult   From fuelEngine.process()
 * @param {object} idleResult   From idleEngine.process()
 * @param {object} safetyResult From safetyEngine.process()
 * @param {object} settings     Merged fleet settings
 */
async function update(trip, packet, gpsResult, fuelResult, idleResult, safetyResult, settings) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const now = new Date();
    const { speed, power, fuel, lat, lng } = packet;

    // ── Baseline stamping ───────────────────────────────────────────────────
    // Stamp once when a trip first becomes running and baseline is not yet set.
    const isRunning       = trip.status === 'in progress' || trip.status === 'running' ||
                            trip.trip_state === 'running' || trip.trip_state === 'approved';
    const needsBaseline   = !trip.start_time && isRunning;

    if (needsBaseline) {
      await client.query(
        `UPDATE trips SET
           start_time          = $1,
           start_fuel          = $2,
           start_lat           = $3,
           start_lng           = $4,
           fuel_price_snapshot = $5,
           trip_state          = 'running'
         WHERE id = $6`,
        [now, fuel, lat, lng, settings.fuelPricePerLiter, trip.id]
      );
      // Mutate in-memory trip so downstream queries in this transaction see it
      trip.start_time          = now;
      trip.start_fuel          = fuel;
      trip.fuel_price_snapshot = settings.fuelPricePerLiter;
    }

    // ── Accumulate deltas ───────────────────────────────────────────────────
    const { distanceDelta }               = gpsResult;
    const { fuelConsumed, refillDetected } = fuelResult;
    const { idleDeltaSec, movingDeltaSec, runningDeltaSec } = idleResult;
    const { overspeedEvent, harshBrakingEvent, rapidAccelEvent } = safetyResult;

    // New cumulative values
    const newFuelUsed      = Number(trip.fuel_used              || 0) + fuelConsumed;
    const newOverspeed     = Number(trip.overspeed_events        || 0) + (overspeedEvent    ? 1 : 0);
    const newHarshBraking  = Number(trip.harsh_braking_events   || 0) + (harshBrakingEvent ? 1 : 0);
    const newRapidAccel    = Number(trip.rapid_accel_events      || 0) + (rapidAccelEvent   ? 1 : 0);
    const newRefillCount   = Number(trip.fuel_refill_count       || 0) + (refillDetected    ? 1 : 0);
    const newMaxSpeed      = Math.max(Number(trip.max_speed      || 0), Number(speed        || 0));
    const newCo2           = newFuelUsed * settings.co2FactorPerLiter;
    const newAlertCount    = Number(trip.alert_count             || 0); // alert increments handled by alertLifecycleService

    const newTripScore = computeTripScore({
      overspeedEvents:    newOverspeed,
      harshBrakingEvents: newHarshBraking,
      rapidAccelEvents:   newRapidAccel,
      alertCount:         newAlertCount,
    });

    const newStatus = deriveTripStatus(power, Number(speed || 0));

    await client.query(
      `UPDATE trips SET
         distance              = distance + $1,
         fuel_used             = $2,
         total_idle_time       = total_idle_time + $3,
         moving_time_seconds   = moving_time_seconds + $4,
         running_time_seconds  = running_time_seconds + $5,
         max_speed             = $6,
         co2_emitted           = $7,
         overspeed_events      = $8,
         harsh_braking_events  = $9,
         rapid_accel_events    = $10,
         fuel_refill_count     = $11,
         trip_score            = $12,
         live_speed            = $13,
         power                 = $14,
         live_fuel_count       = $15,
         status                = $16,
         trip_state            = CASE
                                   WHEN trip_state NOT IN ('paused','completed','cancelled')
                                   THEN 'running'
                                   ELSE trip_state
                                 END,
         updated_at            = NOW()
       WHERE id = $17`,
      [
        distanceDelta,
        newFuelUsed,
        idleDeltaSec,
        movingDeltaSec,
        runningDeltaSec,
        newMaxSpeed,
        newCo2,
        newOverspeed,
        newHarshBraking,
        newRapidAccel,
        newRefillCount,
        newTripScore,
        speed,
        power,
        fuel,
        newStatus,
        trip.id,
      ]
    );

    await client.query('COMMIT');
    return { success: true, tripScore: newTripScore };
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Trip Calculation Engine] Failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { update, computeTripScore };
