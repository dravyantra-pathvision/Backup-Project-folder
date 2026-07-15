// controllers/fleetSettingsController.js
// Replaced in-memory store with PostgreSQL-backed persistence
const { pool } = require('../config/dbconfig');
const { handleError } = require('../utils/responseHandler');
const { logAuditEvent } = require('../utils/auditLogger');

const getFleetSettings = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    const result = await pool.query(
      `SELECT * FROM fleet_settings WHERE uid = $1`, [uid]
    );
    if (result.rows.length === 0) {
      // Return defaults if no row exists
      return res.json({
        speedThreshold: 80,
        fuelDropThreshold: 5.0,
        idleLimit: 15,
        fastagThreshold: 500,
        mileageThreshold: 4.0,
        whatsappEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        emailEnabled: true,
        perTypeToggles: { overSpeed: true, excessIdle: true, fuelDrop: true, geoFence: true, harshBraking: true, eWayBill: true, fastag: true, gpsLost: true },
      });
    }
    const row = result.rows[0];
    return res.json({
      // Existing fields (unchanged for backward compat)
      speedThreshold:    row.speed_threshold,
      fuelDropThreshold: row.fuel_drop_threshold,
      idleLimit:         row.idle_limit,
      fastagThreshold:   row.fastag_threshold,
      mileageThreshold:  row.mileage_threshold,
      whatsappEnabled:   row.whatsapp_enabled,
      smsEnabled:        row.sms_enabled,
      pushEnabled:       row.push_enabled,
      emailEnabled:      row.email_enabled,
      perTypeToggles:    row.per_type_toggles,
      // Analytics engine thresholds (new)
      fuelPricePerLiter:          Number(row.fuel_price_per_liter          ?? 92.0),
      co2FactorPerLiter:          Number(row.co2_factor_per_liter          ?? 2.68),
      gpsDriftThresholdKm:        Number(row.gps_drift_threshold_km        ?? 0.05),
      gpsMaxJumpKm:               Number(row.gps_max_jump_km               ?? 1.0),
      fuelNoiseThresholdLiters:   Number(row.fuel_noise_threshold_liters   ?? 0.3),
      fuelRefillThresholdLiters:  Number(row.fuel_refill_threshold_liters  ?? 5.0),
      fuelTheftThresholdLiters:   Number(row.fuel_theft_threshold_liters   ?? 3.0),
      overspeedThresholdKmh:      Number(row.overspeed_threshold_kmh       ?? row.speed_threshold ?? 80),
      idleWarningSeconds:         Number(row.idle_warning_seconds          ?? 300),
      idleCriticalSeconds:        Number(row.idle_critical_seconds         ?? 900),
      harshBrakeDeltaKmh:         Number(row.harsh_brake_delta_kmh         ?? 30),
      rapidAccelDeltaKmh:         Number(row.rapid_accel_delta_kmh         ?? 25),
      heartbeatTimeoutSeconds:    Number(row.heartbeat_timeout_seconds     ?? 120),
    });
  } catch (err) {
    handleError(res, 'Error fetching fleet settings', err);
  }
};

const putFleetSettings = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    const {
      speedThreshold, fuelDropThreshold, idleLimit, fastagThreshold,
      mileageThreshold, whatsappEnabled, smsEnabled, pushEnabled,
      emailEnabled, perTypeToggles,
      // New analytics fields
      fuelPricePerLiter, co2FactorPerLiter, gpsDriftThresholdKm, gpsMaxJumpKm,
      fuelNoiseThresholdLiters, fuelRefillThresholdLiters, fuelTheftThresholdLiters,
      overspeedThresholdKmh, idleWarningSeconds, idleCriticalSeconds,
      harshBrakeDeltaKmh, rapidAccelDeltaKmh, heartbeatTimeoutSeconds,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO fleet_settings (
        uid, speed_threshold, fuel_drop_threshold, idle_limit, fastag_threshold,
        mileage_threshold, whatsapp_enabled, sms_enabled, push_enabled,
        email_enabled, per_type_toggles,
        fuel_price_per_liter, co2_factor_per_liter, gps_drift_threshold_km, gps_max_jump_km,
        fuel_noise_threshold_liters, fuel_refill_threshold_liters, fuel_theft_threshold_liters,
        overspeed_threshold_kmh, idle_warning_seconds, idle_critical_seconds,
        harsh_brake_delta_kmh, rapid_accel_delta_kmh, heartbeat_timeout_seconds,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW())
      ON CONFLICT (uid) DO UPDATE SET
        speed_threshold              = COALESCE(EXCLUDED.speed_threshold,              fleet_settings.speed_threshold),
        fuel_drop_threshold          = COALESCE(EXCLUDED.fuel_drop_threshold,          fleet_settings.fuel_drop_threshold),
        idle_limit                   = COALESCE(EXCLUDED.idle_limit,                   fleet_settings.idle_limit),
        fastag_threshold             = COALESCE(EXCLUDED.fastag_threshold,             fleet_settings.fastag_threshold),
        mileage_threshold            = COALESCE(EXCLUDED.mileage_threshold,            fleet_settings.mileage_threshold),
        whatsapp_enabled             = COALESCE(EXCLUDED.whatsapp_enabled,             fleet_settings.whatsapp_enabled),
        sms_enabled                  = COALESCE(EXCLUDED.sms_enabled,                  fleet_settings.sms_enabled),
        push_enabled                 = COALESCE(EXCLUDED.push_enabled,                 fleet_settings.push_enabled),
        email_enabled                = COALESCE(EXCLUDED.email_enabled,                fleet_settings.email_enabled),
        per_type_toggles             = COALESCE(EXCLUDED.per_type_toggles,             fleet_settings.per_type_toggles),
        fuel_price_per_liter         = COALESCE(EXCLUDED.fuel_price_per_liter,         fleet_settings.fuel_price_per_liter),
        co2_factor_per_liter         = COALESCE(EXCLUDED.co2_factor_per_liter,         fleet_settings.co2_factor_per_liter),
        gps_drift_threshold_km       = COALESCE(EXCLUDED.gps_drift_threshold_km,       fleet_settings.gps_drift_threshold_km),
        gps_max_jump_km              = COALESCE(EXCLUDED.gps_max_jump_km,              fleet_settings.gps_max_jump_km),
        fuel_noise_threshold_liters  = COALESCE(EXCLUDED.fuel_noise_threshold_liters,  fleet_settings.fuel_noise_threshold_liters),
        fuel_refill_threshold_liters = COALESCE(EXCLUDED.fuel_refill_threshold_liters, fleet_settings.fuel_refill_threshold_liters),
        fuel_theft_threshold_liters  = COALESCE(EXCLUDED.fuel_theft_threshold_liters,  fleet_settings.fuel_theft_threshold_liters),
        overspeed_threshold_kmh      = COALESCE(EXCLUDED.overspeed_threshold_kmh,      fleet_settings.overspeed_threshold_kmh),
        idle_warning_seconds         = COALESCE(EXCLUDED.idle_warning_seconds,         fleet_settings.idle_warning_seconds),
        idle_critical_seconds        = COALESCE(EXCLUDED.idle_critical_seconds,        fleet_settings.idle_critical_seconds),
        harsh_brake_delta_kmh        = COALESCE(EXCLUDED.harsh_brake_delta_kmh,        fleet_settings.harsh_brake_delta_kmh),
        rapid_accel_delta_kmh        = COALESCE(EXCLUDED.rapid_accel_delta_kmh,        fleet_settings.rapid_accel_delta_kmh),
        heartbeat_timeout_seconds    = COALESCE(EXCLUDED.heartbeat_timeout_seconds,    fleet_settings.heartbeat_timeout_seconds),
        updated_at                   = NOW()
      RETURNING *`,
      [
        uid,
        speedThreshold    ?? 80,
        fuelDropThreshold ?? 5.0,
        idleLimit         ?? 15,
        fastagThreshold   ?? 500,
        mileageThreshold  ?? 4.0,
        whatsappEnabled   ?? true,
        smsEnabled        ?? false,
        pushEnabled       ?? true,
        emailEnabled      ?? true,
        perTypeToggles ? JSON.stringify(perTypeToggles) : null,
        fuelPricePerLiter          ?? null,
        co2FactorPerLiter          ?? null,
        gpsDriftThresholdKm        ?? null,
        gpsMaxJumpKm               ?? null,
        fuelNoiseThresholdLiters   ?? null,
        fuelRefillThresholdLiters  ?? null,
        fuelTheftThresholdLiters   ?? null,
        overspeedThresholdKmh      ?? null,
        idleWarningSeconds         ?? null,
        idleCriticalSeconds        ?? null,
        harshBrakeDeltaKmh         ?? null,
        rapidAccelDeltaKmh         ?? null,
        heartbeatTimeoutSeconds    ?? null,
      ]
    );
    const row = result.rows[0];
    const responsePayload = {
      speedThreshold:    row.speed_threshold,
      fuelDropThreshold: row.fuel_drop_threshold,
      idleLimit:         row.idle_limit,
      fastagThreshold:   row.fastag_threshold,
      mileageThreshold:  row.mileage_threshold,
      whatsappEnabled:   row.whatsapp_enabled,
      smsEnabled:        row.sms_enabled,
      pushEnabled:       row.push_enabled,
      emailEnabled:      row.email_enabled,
      perTypeToggles:    row.per_type_toggles,
      fuelPricePerLiter:         Number(row.fuel_price_per_liter          ?? 92.0),
      co2FactorPerLiter:         Number(row.co2_factor_per_liter          ?? 2.68),
      gpsDriftThresholdKm:       Number(row.gps_drift_threshold_km        ?? 0.05),
      gpsMaxJumpKm:              Number(row.gps_max_jump_km               ?? 1.0),
      fuelNoiseThresholdLiters:  Number(row.fuel_noise_threshold_liters   ?? 0.3),
      fuelRefillThresholdLiters: Number(row.fuel_refill_threshold_liters  ?? 5.0),
      fuelTheftThresholdLiters:  Number(row.fuel_theft_threshold_liters   ?? 3.0),
      overspeedThresholdKmh:     Number(row.overspeed_threshold_kmh       ?? 80),
      idleWarningSeconds:        Number(row.idle_warning_seconds          ?? 300),
      idleCriticalSeconds:       Number(row.idle_critical_seconds         ?? 900),
      harshBrakeDeltaKmh:        Number(row.harsh_brake_delta_kmh         ?? 30),
      rapidAccelDeltaKmh:        Number(row.rapid_accel_delta_kmh         ?? 25),
      heartbeatTimeoutSeconds:   Number(row.heartbeat_timeout_seconds     ?? 120),
    };
    
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Fleet Settings',
      action: 'Updated',
      newValue: responsePayload
    }, req);

    return res.json(responsePayload);
  } catch (err) {
    handleError(res, 'Error updating fleet settings', err);
  }
};

module.exports = { getFleetSettings, putFleetSettings };