// services/alertLifecycleService.js
// Full alert lifecycle management with deduplication and state transitions.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * Create a new alert with deduplication.
 * Duplicate = same uid + vehicle + type that is not yet resolved/ignored within 1 hour.
 */
async function createAlert({
  uid, vehiclePlate, tripId, driver,
  type, message, severity = 'warning', category = 'general',
  lat, lng, telemetrySnapshot,
}) {
  try {
    // Deduplication check
    const existingRes = await pool.query(
      `SELECT id FROM alerts
       WHERE uid = $1 AND vehicle_plate = $2 AND type = $3
         AND lifecycle_state NOT IN ('resolved','ignored')
         AND detected_at > NOW() - INTERVAL '1 hour'
       LIMIT 1`,
      [uid, vehiclePlate, type]
    );
    if (existingRes.rows.length > 0) return null; // Suppress duplicate

    const result = await pool.query(
      `INSERT INTO alerts
         (uid, vehicle_plate, trip_id, driver, type, message, severity, category,
          status, lifecycle_state, lat, lng, telemetry_snapshot, detected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending','generated',$9,$10,$11,NOW())
       RETURNING *`,
      [
        uid, vehiclePlate, tripId || null, driver || '',
        type, message, severity, category,
        lat || null, lng || null,
        telemetrySnapshot ? JSON.stringify(telemetrySnapshot) : null,
      ]
    );
    const alert = result.rows[0];

    // Increment alert_count on active trip
    if (tripId) {
      await pool.query(
        'UPDATE trips SET alert_count = alert_count + 1 WHERE id = $1',
        [tripId]
      );
    }

    return alert;
  } catch (e) {
    console.error('[Alert Lifecycle] createAlert failed:', e.message);
    return null;
  }
}

/**
 * Transition an alert to a new lifecycle state.
 * Supported states: seen, acknowledged, resolved, ignored
 */
async function transition(alertId, uid, newState) {
  const validStates = ['seen', 'acknowledged', 'resolved', 'ignored'];
  if (!validStates.includes(newState)) {
    throw new Error(`Invalid lifecycle state: ${newState}`);
  }

  const stateToColumn = {
    seen:         'seen_at',
    acknowledged: 'acknowledged_at',
    resolved:     'resolved_at',
    ignored:      'ignored_at',
  };

  const col = stateToColumn[newState];

  // Map to legacy status for backward compat
  const legacyStatus = {
    seen:         'pending',
    acknowledged: 'acknowledged',
    resolved:     'dismissed',
    ignored:      'dismissed',
  }[newState];

  const result = await pool.query(
    `UPDATE alerts
       SET lifecycle_state = $1,
           ${col}          = NOW(),
           status          = $4,
           updated_at      = NOW()
     WHERE id = $2 AND uid = $3
     RETURNING *`,
    [newState, alertId, uid, legacyStatus]
  );
  return result.rows[0] || null;
}

module.exports = { createAlert, transition };
