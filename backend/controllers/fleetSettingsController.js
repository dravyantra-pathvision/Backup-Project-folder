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
      speedThreshold: row.speed_threshold,
      fuelDropThreshold: row.fuel_drop_threshold,
      idleLimit: row.idle_limit,
      fastagThreshold: row.fastag_threshold,
      mileageThreshold: row.mileage_threshold,
      whatsappEnabled: row.whatsapp_enabled,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
      perTypeToggles: row.per_type_toggles,
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
    } = req.body;

    const result = await pool.query(
      `INSERT INTO fleet_settings (
        uid, speed_threshold, fuel_drop_threshold, idle_limit, fastag_threshold,
        mileage_threshold, whatsapp_enabled, sms_enabled, push_enabled,
        email_enabled, per_type_toggles, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
      ON CONFLICT (uid) DO UPDATE SET
        speed_threshold       = COALESCE(EXCLUDED.speed_threshold, fleet_settings.speed_threshold),
        fuel_drop_threshold   = COALESCE(EXCLUDED.fuel_drop_threshold, fleet_settings.fuel_drop_threshold),
        idle_limit            = COALESCE(EXCLUDED.idle_limit, fleet_settings.idle_limit),
        fastag_threshold      = COALESCE(EXCLUDED.fastag_threshold, fleet_settings.fastag_threshold),
        mileage_threshold     = COALESCE(EXCLUDED.mileage_threshold, fleet_settings.mileage_threshold),
        whatsapp_enabled      = COALESCE(EXCLUDED.whatsapp_enabled, fleet_settings.whatsapp_enabled),
        sms_enabled           = COALESCE(EXCLUDED.sms_enabled, fleet_settings.sms_enabled),
        push_enabled          = COALESCE(EXCLUDED.push_enabled, fleet_settings.push_enabled),
        email_enabled         = COALESCE(EXCLUDED.email_enabled, fleet_settings.email_enabled),
        per_type_toggles      = COALESCE(EXCLUDED.per_type_toggles, fleet_settings.per_type_toggles),
        updated_at            = NOW()
      RETURNING *`,
      [uid,
        speedThreshold ?? 80,
        fuelDropThreshold ?? 5.0,
        idleLimit ?? 15,
        fastagThreshold ?? 500,
        mileageThreshold ?? 4.0,
        whatsappEnabled ?? true,
        smsEnabled ?? false,
        pushEnabled ?? true,
        emailEnabled ?? true,
        perTypeToggles ? JSON.stringify(perTypeToggles) : null,
      ]
    );
    const row = result.rows[0];
    const responsePayload = {
      speedThreshold: row.speed_threshold,
      fuelDropThreshold: row.fuel_drop_threshold,
      idleLimit: row.idle_limit,
      fastagThreshold: row.fastag_threshold,
      mileageThreshold: row.mileage_threshold,
      whatsappEnabled: row.whatsapp_enabled,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
      perTypeToggles: row.per_type_toggles,
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