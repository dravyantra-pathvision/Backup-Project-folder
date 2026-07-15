// services/tripCompletionService.js
// Trip Completion Engine.
// Called when trip_completed is set to true.
// Freezes stats, updates lifetime records, recalculates scores.

'use strict';
const { pool } = require('../config/dbconfig');
const vehicleLifetimeEngine = require('./vehicleLifetimeEngine');
const driverScoreService    = require('./driverScoreService');
const vehicleHealthService  = require('./vehicleHealthService');

/**
 * Execute all completion steps for a trip.
 *
 * @param {string} tripId Trip ID
 * @param {string} uid    Organization UID
 */
async function onTripCompleted(tripId, uid) {
  try {
    // Load the full trip
    const tripRes = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND uid = $2',
      [tripId, uid]
    );
    if (!tripRes.rows.length) {
      console.error(`[Trip Completion] Trip not found: ${tripId}`);
      return;
    }
    const trip = tripRes.rows[0];

    // Skip if already frozen
    if (trip.frozen_at) {
      console.log(`[Trip Completion] Trip ${tripId} already frozen`);
      return;
    }

    const now = new Date();

    // Load co2 factor from settings
    const settingsRes = await pool.query(
      'SELECT co2_factor_per_liter FROM fleet_settings WHERE uid = $1',
      [uid]
    );
    const co2Factor  = Number(settingsRes.rows[0]?.co2_factor_per_liter ?? 2.68);
    const finalFuel  = Number(trip.fuel_used || 0);
    const finalCo2   = finalFuel * co2Factor;

    // ── STEP 1: Freeze trip statistics ─────────────────────────────────────
    await pool.query(
      `UPDATE trips SET
         completed_at  = $1,
         frozen_at     = $1,
         trip_state    = 'completed',
         trip_completed= TRUE,
         status        = 'completed',
         co2_emitted   = $2,
         updated_at    = $1
       WHERE id = $3`,
      [now, finalCo2, tripId]
    );

    // Reload the frozen trip for accurate accumulation
    const frozenRes = await pool.query('SELECT * FROM trips WHERE id = $1', [tripId]);
    const frozenTrip = frozenRes.rows[0];

    // ── STEP 2: Mark vehicle Available (preserve driver-vehicle link) ───────
    if (trip.vehicle) {
      await pool.query(
        `UPDATE vehicles
           SET status    = 'Available',
               is_active = FALSE,
               speed     = 0
         WHERE plate = $1 AND uid = $2`,
        [trip.vehicle, uid]
      );
    }

    // ── STEP 3: Mark driver Available (preserve assignment) ─────────────────
    if (trip.driver) {
      await pool.query(
        `UPDATE drivers
           SET status    = 'Available',
               is_active = FALSE
         WHERE (name = $1 OR id = $1) AND uid = $2`,
        [trip.driver, uid]
      );
    }

    // ── STEP 4: Accumulate into vehicle lifetime stats ───────────────────────
    await vehicleLifetimeEngine.accumulate(frozenTrip, uid);

    // ── STEP 5: Recalculate driver performance score ─────────────────────────
    if (trip.driver) {
      await driverScoreService.recalculate(trip.driver, uid);
    }

    // ── STEP 6: Recalculate vehicle health score ─────────────────────────────
    if (trip.vehicle) {
      await vehicleHealthService.recalculate(trip.vehicle, uid);
    }

    console.log(`[Trip Completion] ✅ Trip ${tripId} fully processed`);
  } catch (e) {
    console.error('[Trip Completion] Failed:', e.message);
  }
}

module.exports = { onTripCompleted };
