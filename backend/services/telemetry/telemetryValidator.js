// services/telemetry/telemetryValidator.js
// LAYER 1 — Telemetry Validation
// Validates every incoming packet before it enters the processing pipeline.
// Returns: { isValid, reason, context: { device, vehicle, trip, settings, uid } }

'use strict';
const { pool } = require('../../config/dbconfig');

const DEFAULT_SETTINGS = {
  fuelPricePerLiter:         100.0,
  co2FactorPerLiter:         2.68,
  gpsDriftThresholdKm:       0.005,
  gpsMaxJumpKm:              1.0,
  fuelNoiseThresholdLiters:  0.3,
  fuelRefillThresholdLiters: 5.0,
  fuelTheftThresholdLiters:  3.0,
  overspeedThresholdKmh:     80,
  idleWarningSec:            180,
  idleCriticalSec:           900,
  harshBrakeDeltaKmh:        20,
  rapidAccelDeltaKmh:        25,
  heartbeatTimeoutSec:       120,
};

function mergeSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    fuelPricePerLiter:         Number(row.fuel_price_per_liter         ?? DEFAULT_SETTINGS.fuelPricePerLiter),
    co2FactorPerLiter:         Number(row.co2_factor_per_liter         ?? DEFAULT_SETTINGS.co2FactorPerLiter),
    gpsDriftThresholdKm:       Number(row.gps_drift_threshold_km       ?? DEFAULT_SETTINGS.gpsDriftThresholdKm),
    gpsMaxJumpKm:              Number(row.gps_max_jump_km              ?? DEFAULT_SETTINGS.gpsMaxJumpKm),
    fuelNoiseThresholdLiters:  Number(row.fuel_noise_threshold_liters  ?? DEFAULT_SETTINGS.fuelNoiseThresholdLiters),
    fuelRefillThresholdLiters: Number(row.fuel_refill_threshold_liters ?? DEFAULT_SETTINGS.fuelRefillThresholdLiters),
    fuelTheftThresholdLiters:  Number(row.fuel_theft_threshold_liters  ?? row.fuel_drop_threshold ?? DEFAULT_SETTINGS.fuelTheftThresholdLiters),
    overspeedThresholdKmh:     Number(row.overspeed_threshold_kmh      ?? row.speed_threshold ?? DEFAULT_SETTINGS.overspeedThresholdKmh),
    idleWarningSec:            Number(row.idle_warning_seconds         ?? (row.idle_limit ? Number(row.idle_limit) * 60 : DEFAULT_SETTINGS.idleWarningSec)),
    idleCriticalSec:           Number(row.idle_critical_seconds        ?? DEFAULT_SETTINGS.idleCriticalSec),
    harshBrakeDeltaKmh:        Number(row.harsh_brake_delta_kmh        ?? DEFAULT_SETTINGS.harshBrakeDeltaKmh),
    rapidAccelDeltaKmh:        Number(row.rapid_accel_delta_kmh        ?? DEFAULT_SETTINGS.rapidAccelDeltaKmh),
    heartbeatTimeoutSec:       Number(row.heartbeat_timeout_seconds    ?? DEFAULT_SETTINGS.heartbeatTimeoutSec),
  };
}

function invalid(reason) {
  return { isValid: false, reason, context: null };
}

async function validate(packet) {
  const { deviceId, lat, lng, speed, fuel } = packet;

  // 1. Schema: deviceId is required
  if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
    return invalid('Missing or invalid deviceId');
  }

  // 2. GPS range validation
  if (lat !== null && lat !== undefined) {
    if (typeof lat !== 'number' || lat < -90 || lat > 90)  return invalid(`GPS lat out of range: ${lat}`);
    if (typeof lng !== 'number' || lng < -180 || lng > 180) return invalid(`GPS lng out of range: ${lng}`);
    if (lat === 0 && lng === 0) return invalid('GPS null island (0,0) rejected');
  }

  // 3. Speed range
  if (speed !== undefined && speed !== null) {
    if (typeof speed !== 'number' || speed < 0 || speed > 300) return invalid(`Speed out of range: ${speed}`);
  }

  // 4. Fuel range
  if (fuel !== undefined && fuel !== null) {
    if (typeof fuel !== 'number' || fuel < 0 || fuel > 10000) return invalid(`Fuel out of range: ${fuel}`);
  }

  // 5. Load device from DB
  const deviceRes = await pool.query(
    'SELECT * FROM devices WHERE device_id = $1',
    [deviceId.trim()]
  );
  if (deviceRes.rows.length === 0) {
    return invalid(`Unknown device: ${deviceId}`);
  }
  const device = deviceRes.rows[0];

  // 6. Device must be Active or Assigned
  if (device.status !== 'Active' && device.status !== 'Assigned') {
    return invalid(`Device status is '${device.status}' — must be Active or Assigned`);
  }

  // 7. Device must belong to an organization
  if (!device.assigned_organization) {
    return invalid('Device has no organization assignment');
  }
  const uid = device.assigned_organization;

  // 8. Device must be assigned to a vehicle
  if (!device.assigned_vehicle) {
    return invalid('Device is not assigned to any vehicle');
  }

  // 9. Load vehicle — must belong to same org
  const vehicleRes = await pool.query(
    'SELECT * FROM vehicles WHERE plate = $1 AND uid = $2',
    [device.assigned_vehicle, uid]
  );
  if (vehicleRes.rows.length === 0) {
    return invalid(`Vehicle '${device.assigned_vehicle}' not found in organization`);
  }
  const vehicle = vehicleRes.rows[0];

  // 10. Verify vehicle's device_id matches
  if (vehicle.device_id && vehicle.device_id !== deviceId.trim()) {
    return invalid(`Vehicle ${vehicle.plate} is assigned to device ${vehicle.device_id}, not ${deviceId}`);
  }

  // 11. Load active trip (if any)
  const tripRes = await pool.query(
    `SELECT * FROM trips
     WHERE vehicle = $1 AND uid = $2
       AND trip_completed IS NOT TRUE
       AND status NOT IN ('cancelled', 'completed')
     ORDER BY created_at DESC LIMIT 1`,
    [vehicle.plate, uid]
  );
  const trip = tripRes.rows[0] || null;

  // 12. If active trip, verify vehicle matches (defense in depth)
  if (trip && trip.vehicle !== vehicle.plate) {
    return invalid(`Trip vehicle mismatch: trip=${trip.vehicle}, device vehicle=${vehicle.plate}`);
  }

  // 13. Load fleet settings
  const settingsRes = await pool.query('SELECT * FROM fleet_settings WHERE uid = $1', [uid]);
  const settings = mergeSettings(settingsRes.rows[0] || null);

  return {
    isValid: true,
    reason: null,
    context: { device, vehicle, trip, settings, uid },
  };
}

module.exports = { validate };
