// services/telemetry/fuelEngine.js
// LAYER 3 — Fuel Calculation Engine
// Handles consumption, refill detection, theft detection.

'use strict';
const { pool } = require('../../config/dbconfig');

/**
 * Process fuel level change from a telemetry packet.
 *
 * @param {object} vehicle  Current vehicle row (has .fuel)
 * @param {object|null} trip Active trip (may be null for parked vehicles)
 * @param {object} packet   Incoming telemetry packet
 * @param {object} settings Merged fleet settings
 * @returns {{ fuelConsumed, refillDetected, theftDetected, refillAmount, theftAmount }}
 */
async function process(vehicle, trip, packet, settings) {
  const { fuel: currentFuel, lat, lng, power, speed } = packet;
  const previousFuel = vehicle.fuel;

  const result = {
    fuelConsumed:    0,
    refillDetected:  false,
    theftDetected:   false,
    refillAmount:    0,
    theftAmount:     0,
  };

  // Cannot calculate without both values
  if (previousFuel === null || previousFuel === undefined ||
      currentFuel  === null || currentFuel  === undefined) {
    return result;
  }

  const fuelDelta = previousFuel - currentFuel; // positive = consumed, negative = refill

  // ── FUEL INCREASED (refill) ─────────────────────────────────────────────
  if (fuelDelta < 0) {
    const increase = Math.abs(fuelDelta);
    if (increase >= settings.fuelRefillThresholdLiters) {
      result.refillDetected = true;
      result.refillAmount   = increase;
      await _storeRefillEvent({ vehicle, trip, packet, increase, previousFuel, currentFuel });
    }
    // Never count refill as consumption
    return result;
  }

  // ── FUEL DECREASED ─────────────────────────────────────────────────────
  if (fuelDelta > 0) {
    // Below noise threshold — sensor sloshing, ignore
    if (fuelDelta < settings.fuelNoiseThresholdLiters) {
      return result;
    }

    // Fuel Theft: sudden significant drop >= fuelTheftThresholdLiters (default 3.0L)
    // Compares incoming fuel reading with previous recorded fuel reading (sent every 5s or upon restart/wakeup).
    // Normal 5s driving consumption is under 0.1L; a drop >= 3.0L indicates fuel theft/siphoning.
    if (fuelDelta >= settings.fuelTheftThresholdLiters) {
      result.theftDetected = true;
      result.theftAmount   = fuelDelta;
      await _storeTheftEvent({ vehicle, trip, packet, fuelDelta, previousFuel, currentFuel });
      return result; // Don't count theft as normal consumption
    }

    // Normal consumption
    result.fuelConsumed = fuelDelta;
  }

  return result;
}

async function _storeRefillEvent({ vehicle, trip, packet, increase, previousFuel, currentFuel }) {
  try {
    await pool.query(
      `INSERT INTO fuel_refill_events
         (uid, vehicle_plate, trip_id, driver, fuel_before, fuel_after, amount_filled, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        vehicle.uid,
        vehicle.plate,
        trip ? trip.id : null,
        trip ? trip.driver : null,
        previousFuel,
        currentFuel,
        increase,
        packet.lat || null,
        packet.lng || null,
      ]
    );
  } catch (e) {
    console.error('[Fuel Engine] Failed to store refill event:', e.message);
  }
}

async function _storeTheftEvent({ vehicle, trip, packet, fuelDelta, previousFuel, currentFuel }) {
  try {
    await pool.query(
      `INSERT INTO fuel_theft_events
         (uid, vehicle_plate, trip_id, driver, fuel_before, fuel_after, fuel_lost, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        vehicle.uid,
        vehicle.plate,
        trip ? trip.id : null,
        trip ? trip.driver : null,
        previousFuel,
        currentFuel,
        fuelDelta,
        packet.lat || null,
        packet.lng || null,
      ]
    );
  } catch (e) {
    console.error('[Fuel Engine] Failed to store theft event:', e.message);
  }
}

module.exports = { process };
