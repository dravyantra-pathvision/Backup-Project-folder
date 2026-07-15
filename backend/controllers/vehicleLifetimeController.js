// controllers/vehicleLifetimeController.js
// Vehicle Lifetime Statistics API.
// Returns accumulated per-vehicle stats from vehicle_lifetime_stats table.
// avg_speed and fuel_cost are derived on response — never stored.

'use strict';
const { pool }        = require('../config/dbconfig');
const { handleError } = require('../utils/responseHandler');

// GET /api/analytics/vehicles/:plate/lifetime
const getLifetimeStats = async (req, res) => {
  const uid   = req.user.uid;
  const plate = req.params.plate;
  try {
    const result = await pool.query(
      'SELECT * FROM vehicle_lifetime_stats WHERE plate = $1 AND uid = $2',
      [plate, uid]
    );

    // Return zero-stats for vehicles with no completed trips yet
    if (!result.rows.length) {
      return res.json({
        plate,
        uid,
        totalDistanceKm:      0,
        totalFuelConsumedL:   0,
        totalFuelCostRupees:  0,   // derived
        totalTrips:           0,
        totalCompletedTrips:  0,
        lifetimeIdleSeconds:  0,
        lifetimeRunningSeconds: 0,
        lifetimeMovingSeconds:  0,
        lifetimeCo2Kg:        0,
        fuelTheftCount:       0,
        fuelRefillCount:      0,
        totalOverspeedEvents: 0,
        totalHarshBraking:    0,
        totalAlertCount:      0,
        avgTripScore:         100,
        vehicleHealthScore:   100,
        engineHours:          0,
        avgEfficiencyKmpl:    0,   // derived
        message:              'No completed trips recorded yet',
      });
    }

    const row = result.rows[0];

    // Load fuel price for cost derivation
    const settingsRes = await pool.query(
      'SELECT fuel_price_per_liter FROM fleet_settings WHERE uid = $1',
      [uid]
    );
    const fuelPrice     = Number(settingsRes.rows[0]?.fuel_price_per_liter ?? 92.0);
    const distanceKm    = Number(row.total_distance_km     || 0);
    const fuelConsumed  = Number(row.total_fuel_consumed_l || 0);

    res.json({
      plate:                row.plate,
      uid:                  row.uid,
      totalDistanceKm:      Number(distanceKm.toFixed(2)),
      totalFuelConsumedL:   Number(fuelConsumed.toFixed(2)),
      totalFuelCostRupees:  Number((fuelConsumed * fuelPrice).toFixed(2)), // derived
      totalTrips:           Number(row.total_trips              || 0),
      totalCompletedTrips:  Number(row.total_completed_trips    || 0),
      lifetimeIdleSeconds:  Number(row.lifetime_idle_seconds    || 0),
      lifetimeRunningSeconds: Number(row.lifetime_running_seconds || 0),
      lifetimeMovingSeconds:  Number(row.lifetime_moving_seconds  || 0),
      lifetimeCo2Kg:        Number(Number(row.lifetime_co2_kg   || 0).toFixed(2)),
      fuelTheftCount:       Number(row.fuel_theft_count         || 0),
      fuelRefillCount:      Number(row.fuel_refill_count        || 0),
      totalOverspeedEvents: Number(row.total_overspeed_events   || 0),
      totalHarshBraking:    Number(row.total_harsh_braking      || 0),
      totalAlertCount:      Number(row.total_alert_count        || 0),
      avgTripScore:         Number(Number(row.avg_trip_score    || 100).toFixed(1)),
      vehicleHealthScore:   Number(row.vehicle_health_score     || 100),
      engineHours:          Number(Number(row.engine_hours      || 0).toFixed(2)),
      // Derived values — never stored in DB
      avgEfficiencyKmpl:    fuelConsumed > 0 ? Number((distanceKm / fuelConsumed).toFixed(2)) : 0,
      updatedAt:            row.updated_at,
    });
  } catch (err) {
    handleError(res, 'Error fetching vehicle lifetime stats', err);
  }
};

module.exports = { getLifetimeStats };
