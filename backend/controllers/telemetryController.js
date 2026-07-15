// controllers/telemetryController.js
// Main Telemetry Ingestion Orchestrator
// Pipeline: Validate → GPS → Fuel → Idle → Safety → Device Health → Trip Calc → Alerts

'use strict';
const { pool }                  = require('../config/dbconfig');
const telemetryValidator        = require('../services/telemetry/telemetryValidator');
const gpsEngine                 = require('../services/telemetry/gpsEngine');
const fuelEngine                = require('../services/telemetry/fuelEngine');
const idleEngine                = require('../services/telemetry/idleEngine');
const safetyEngine              = require('../services/telemetry/safetyEngine');
const deviceHealthEngine        = require('../services/telemetry/deviceHealthEngine');
const tripCalculationEngine     = require('../services/tripCalculationEngine');
const alertLifecycleService     = require('../services/alertLifecycleService');

// ═══════════════════════════════════════════════════════════════════════════════
// Main handler
// ═══════════════════════════════════════════════════════════════════════════════
const ingestTelemetry = async (req, res) => {
  const packet = req.body;
  const { deviceId, lat, lng, speed, power, fuel, vibration } = packet;

  // ── STEP 1: Validate packet & load context ────────────────────────────────
  const validation = await telemetryValidator.validate(packet);

  // ── STEP 2: Archive packet to telemetry_history (always) ─────────────────
  // Even invalid packets are stored for debugging — with is_valid=false.
  _storeTelemetryHistory(packet, validation).catch(e =>
    console.error('[Telemetry] history store error:', e.message)
  );

  if (!validation.isValid) {
    // Return 200 so device doesn't enter a retry storm
    console.warn(`[Telemetry] Rejected | device=${deviceId} | reason=${validation.reason}`);
    return res.json({ success: false, rejected: true, reason: validation.reason });
  }

  const { device, vehicle, trip, settings, uid } = validation.context;

  // ── STEP 3: Update device health (always for any valid device) ────────────
  deviceHealthEngine.update(device, packet, settings).catch(e =>
    console.error('[Telemetry] device health error:', e.message)
  );

  // ── STEP 4: Update vehicle live data (always) ─────────────────────────────
  _updateVehicleLive(vehicle, packet).catch(e =>
    console.error('[Telemetry] vehicle live error:', e.message)
  );

  // ── STEP 5: If no active trip — stop here. Heartbeat/location stored. ─────
  if (!trip) {
    return res.json({ success: true, message: 'Telemetry stored — no active trip' });
  }

  // ── STEP 6: GPS Engine ────────────────────────────────────────────────────
  const gpsResult = gpsEngine.calculate(vehicle, packet, settings);

  // ── STEP 7: Fuel Engine ───────────────────────────────────────────────────
  const fuelResult = await fuelEngine.process(vehicle, trip, packet, settings);

  // ── STEP 8: Time delta since last trip update (capped at 60 seconds) ──────
  const lastUpdate    = trip.updated_at ? new Date(trip.updated_at) : new Date();
  const timeDeltaSec  = Math.min((Date.now() - lastUpdate.getTime()) / 1000, 60);

  // ── STEP 9: Idle Engine ───────────────────────────────────────────────────
  const idleResult = idleEngine.process(trip, packet, settings, timeDeltaSec);

  // ── STEP 10: Safety Engine ────────────────────────────────────────────────
  const safetyResult = safetyEngine.process(vehicle, trip, packet, settings);

  // ── STEP 11: Update trip statistics atomically ────────────────────────────
  try {
    await tripCalculationEngine.update(trip, packet, gpsResult, fuelResult, idleResult, safetyResult, settings);
  } catch (e) {
    console.error('[Telemetry] Trip calc engine error:', e.message);
    // Non-fatal path: continue with alert generation
  }

  // ── STEP 12: Generate alerts ──────────────────────────────────────────────
  _generateAlerts({ uid, vehicle, trip, fuelResult, idleResult, safetyResult, settings, packet })
    .catch(e => console.error('[Telemetry] alert gen error:', e.message));

  // ── STEP 13: Vibration / tampering check ─────────────────────────────────
  if (power === false && vibration !== undefined && Number(vibration) > 2.5) {
    alertLifecycleService.createAlert({
      uid,
      vehiclePlate: vehicle.plate,
      tripId:       trip.id,
      driver:       trip.driver,
      type:         'Vibration / Tampering',
      message:      'Abnormal vibration detected while engine is OFF. Possible theft or towing attempt.',
      severity:     'critical',
      category:     'security',
      lat,
      lng,
    }).catch(e => console.error('[Telemetry] tampering alert error:', e.message));
  }

  res.json({ success: true });
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers (internal, non-blocking)
// ═══════════════════════════════════════════════════════════════════════════════

async function _updateVehicleLive(vehicle, packet) {
  const { lat, lng, speed, power, fuel, vibration } = packet;
  await pool.query(
    `UPDATE vehicles
       SET lat       = COALESCE($1, lat),
           lng       = COALESCE($2, lng),
           speed     = COALESCE($3, speed),
           fuel      = COALESCE($4, fuel),
           is_active = $5,
           vibration = COALESCE($6, vibration),
           route     = CASE WHEN $7 = TRUE AND $1 IS NOT NULL
                            THEN route || $8::jsonb
                            ELSE route
                       END,
           updated_at = NOW()
     WHERE device_id = $9`,
    [
      lat, lng, speed, fuel,
      power === true,
      vibration || 0.0,
      speed > 0 && lat && lng,
      JSON.stringify([[lat, lng]]),
      vehicle.device_id,
    ]
  );
}

async function _storeTelemetryHistory(packet, validation) {
  const { deviceId, lat, lng, speed, fuel, power, vibration, heading, rpm, timestamp } = packet;
  const ctx = validation.context;
  await pool.query(
    `INSERT INTO telemetry_history
       (device_id, vehicle_plate, trip_id, uid,
        lat, lng, speed, fuel_level, engine_on, vibration, heading, rpm,
        heartbeat, raw_timestamp, received_at, is_valid, validation_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15,$16)`,
    [
      deviceId,
      ctx?.vehicle?.plate || null,
      ctx?.trip?.id       || null,
      ctx?.uid            || null,
      lat   || null, lng  || null,
      speed || null, fuel || null,
      power !== undefined ? power : null,
      vibration || null,
      heading   || null,
      rpm       || null,
      packet.heartbeat || null,
      timestamp ? new Date(timestamp) : null,
      validation.isValid,
      validation.reason || null,
    ]
  );
}

async function _generateAlerts({ uid, vehicle, trip, fuelResult, idleResult, safetyResult, settings, packet }) {
  const base = { uid, vehiclePlate: vehicle.plate, tripId: trip.id, driver: trip.driver, lat: packet.lat, lng: packet.lng };

  if (fuelResult.theftDetected) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'fuel_theft',
      message:  `Fuel theft detected — ${Number(fuelResult.theftAmount).toFixed(2)}L lost while engine was OFF.`,
      severity: 'critical',
      category: 'fuel',
    });
  }

  if (fuelResult.refillDetected) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'fuel_refill',
      message:  `Fuel refill detected — ${Number(fuelResult.refillAmount).toFixed(2)}L added.`,
      severity: 'info',
      category: 'fuel',
    });
  }

  if (idleResult.warningTriggered) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'idle_warning',
      message:  'Vehicle has been idling for over 5 minutes.',
      severity: 'warning',
      category: 'idle',
    });
  }

  if (idleResult.criticalTriggered) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'idle_critical',
      message:  'Vehicle has been idling for over 15 minutes. Immediate action required.',
      severity: 'critical',
      category: 'idle',
    });
  }

  if (safetyResult.overspeedEvent) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'overspeed',
      message:  `Overspeed: ${packet.speed} km/h (limit: ${settings.overspeedThresholdKmh} km/h).`,
      severity: 'warning',
      category: 'safety',
    });
  }

  if (safetyResult.harshBrakingEvent) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'harsh_braking',
      message:  'Harsh braking detected.',
      severity: 'warning',
      category: 'safety',
    });
  }

  if (safetyResult.rapidAccelEvent) {
    await alertLifecycleService.createAlert({
      ...base,
      type:     'rapid_acceleration',
      message:  'Rapid acceleration detected.',
      severity: 'warning',
      category: 'safety',
    });
  }
}

module.exports = { ingestTelemetry };
