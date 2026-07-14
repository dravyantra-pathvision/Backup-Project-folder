// modules/admin/alerts.service.js
const { pool } = require('../../config/dbconfig');

// ── Helper: Insert audit log entry ──────────────────────────────────────────
const _logAction = async (client, alertId, adminUid, action, details = null) => {
  await client.query(
    `INSERT INTO alert_audit_log (alert_id, admin_uid, action, details) VALUES ($1, $2, $3, $4)`,
    [alertId, adminUid || 'system', action, details]
  );
};

// ── GET all alerts with pagination, search, filters ─────────────────────────
const getAllAlerts = async ({
  page = 1, limit = 20, search, organization, fleetOwner,
  severity, status, type, vehicle, driver, fromDate, toDate, sort = 'detected_at',
}) => {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(
      a.vehicle_plate ILIKE $${idx} OR
      a.driver ILIKE $${idx} OR
      a.type ILIKE $${idx} OR
      a.device_id ILIKE $${idx} OR
      a.trip_id::text ILIKE $${idx} OR
      fo.company_name ILIKE $${idx} OR
      u.full_name ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx++;
  }
  if (organization) { conditions.push(`fo.company_name ILIKE $${idx++}`); params.push(`%${organization}%`); }
  if (fleetOwner)   { conditions.push(`u.full_name ILIKE $${idx++}`);     params.push(`%${fleetOwner}%`); }
  if (severity)     { conditions.push(`a.severity ILIKE $${idx++}`);      params.push(severity); }
  if (status)       { conditions.push(`a.status ILIKE $${idx++}`);        params.push(status); }
  if (type)         { conditions.push(`a.type ILIKE $${idx++}`);          params.push(type); }
  if (vehicle)      { conditions.push(`a.vehicle_plate ILIKE $${idx++}`); params.push(`%${vehicle}%`); }
  if (driver)       { conditions.push(`a.driver ILIKE $${idx++}`);        params.push(`%${driver}%`); }
  if (fromDate)     { conditions.push(`a.detected_at >= $${idx++}`);      params.push(fromDate); }
  if (toDate)       { conditions.push(`a.detected_at <= $${idx++}`);      params.push(toDate + ' 23:59:59'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSorts = ['detected_at', 'severity', 'status', 'type'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'detected_at';

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM alerts a
     LEFT JOIN users u ON a.uid = u.uid
     LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
     ${where}`, params
  );

  const dataRes = await pool.query(
    `SELECT
      a.id, a.uid, a.trip_id, a.vehicle_plate, a.driver, a.device_id,
      a.type, a.message, a.severity, a.category, a.status, a.priority,
      a.source, a.lat, a.lng, a.notified_fleet_owner, a.admin_notes,
      a.detected_at, a.acknowledged_at, a.dismissed_at, a.resolved_at, a.updated_at,
      fo.company_name AS organization_name,
      u.full_name AS fleet_owner_name, u.email AS fleet_owner_email
     FROM alerts a
     LEFT JOIN users u ON a.uid = u.uid
     LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
     ${where}
     ORDER BY a.${sortCol} DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { alerts: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
};

// ── GET single alert with audit log ─────────────────────────────────────────
const getAlertById = async (id) => {
  const alertRes = await pool.query(
    `SELECT
      a.*,
      fo.company_name AS organization_name,
      u.full_name AS fleet_owner_name, u.email AS fleet_owner_email,
      u.phone AS fleet_owner_phone
     FROM alerts a
     LEFT JOIN users u ON a.uid = u.uid
     LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
     WHERE a.id = $1`, [id]
  );

  if (!alertRes.rows[0]) return null;

  const auditRes = await pool.query(
    `SELECT * FROM alert_audit_log WHERE alert_id = $1 ORDER BY created_at ASC`, [id]
  );

  // Mark as viewed
  await pool.query(
    `INSERT INTO alert_audit_log (alert_id, action, details) VALUES ($1, 'viewed', 'Alert viewed in Admin Panel')`,
    [id]
  );

  return { ...alertRes.rows[0], auditLog: auditRes.rows };
};

// ── PATCH alert status ───────────────────────────────────────────────────────
const updateAlertStatus = async (id, status, adminUid, notes) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updates = [`status = $1`, `updated_at = CURRENT_TIMESTAMP`];
    const params = [status];
    let idx = 2;

    if (status === 'Acknowledged') {
      updates.push(`acknowledged_at = CURRENT_TIMESTAMP`);
    } else if (status === 'Resolved' || status === 'Dismissed') {
      updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      if (status === 'Dismissed') updates.push(`dismissed_at = CURRENT_TIMESTAMP`);
    }
    if (notes) {
      updates.push(`admin_notes = $${idx++}`);
      params.push(notes);
    }
    params.push(id);

    const res = await client.query(
      `UPDATE alerts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    await _logAction(client, id, adminUid, 'status_changed', `Status changed to: ${status}${notes ? ' | Notes: ' + notes : ''}`);
    await client.query('COMMIT');
    return res.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ── POST admin comment ───────────────────────────────────────────────────────
const addAlertComment = async (id, comment, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Append comment to admin_notes field
    await client.query(
      `UPDATE alerts SET
        admin_notes = COALESCE(admin_notes || E'\n', '') || $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [`[${new Date().toISOString()}] ${comment}`, id]
    );
    await _logAction(client, id, adminUid, 'comment', comment);
    await client.query('COMMIT');
    return { success: true };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ── POST notify fleet owner ──────────────────────────────────────────────────
const notifyFleetOwner = async (id, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE alerts SET notified_fleet_owner = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]
    );
    // TODO: Integrate with email/push provider (Nodemailer / Firebase Cloud Messaging)
    await _logAction(client, id, adminUid, 'notified', 'Notification sent to Fleet Owner');
    await client.query('COMMIT');
    return { success: true, message: 'Fleet Owner notified' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ── GET alert statistics dashboard ──────────────────────────────────────────
const getAlertStatistics = async () => {
  const today = 'CURRENT_DATE';
  const query = `
    SELECT
      (SELECT COUNT(*) FROM alerts WHERE severity = 'Critical' AND detected_at >= ${today}) AS "criticalToday",
      (SELECT COUNT(*) FROM alerts WHERE type = 'Fuel Theft' AND detected_at >= ${today}) AS "fuelTheftToday",
      (SELECT COUNT(*) FROM alerts WHERE type = 'Overspeed' AND detected_at >= ${today}) AS "overspeedToday",
      (SELECT COUNT(*) FROM alerts WHERE type = 'Device Offline') AS "offlineDevices",
      (SELECT COUNT(*) FROM alerts WHERE type = 'Vehicle Offline') AS "offlineVehicles",
      (SELECT COUNT(*) FROM alerts WHERE status IN ('New', 'Acknowledged', 'In Progress')) AS "pendingAlerts",
      (SELECT COUNT(*) FROM alerts WHERE status = 'Resolved' AND resolved_at >= ${today}) AS "resolvedToday",
      (SELECT COUNT(*) FROM alerts WHERE detected_at >= ${today}) AS "totalToday",
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at))/60)::numeric, 1) 
       FROM alerts WHERE status = 'Resolved' AND resolved_at IS NOT NULL) AS "avgResolutionMinutes"
  `;
  const res = await pool.query(query);

  // Alerts by severity
  const bySeverity = await pool.query(
    `SELECT severity, COUNT(*) AS count FROM alerts WHERE status IN ('New','Acknowledged','In Progress') GROUP BY severity ORDER BY count DESC`
  );

  // Alerts by type (top 8)
  const byType = await pool.query(
    `SELECT type, COUNT(*) AS count FROM alerts WHERE detected_at >= CURRENT_DATE - INTERVAL '7 days' GROUP BY type ORDER BY count DESC LIMIT 8`
  );

  // Alerts by organization (top 8)
  const byOrg = await pool.query(
    `SELECT fo.company_name, COUNT(a.id) AS count
     FROM alerts a
     LEFT JOIN users u ON a.uid = u.uid
     LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
     WHERE a.detected_at >= CURRENT_DATE - INTERVAL '7 days'
     GROUP BY fo.company_name ORDER BY count DESC LIMIT 8`
  );

  return {
    ...res.rows[0],
    bySeverity: bySeverity.rows,
    byType: byType.rows,
    byOrganization: byOrg.rows,
  };
};

// ── GET distinct filter options (types, orgs, etc.) ─────────────────────────
const getAlertFilterOptions = async () => {
  const [types, orgs] = await Promise.all([
    pool.query(`SELECT DISTINCT type FROM alerts WHERE type IS NOT NULL ORDER BY type`),
    pool.query(`SELECT DISTINCT company_name FROM fleet_onboarding WHERE status = 'Approved' ORDER BY company_name`),
  ]);
  return { types: types.rows.map(r => r.type), organizations: orgs.rows.map(r => r.company_name) };
};

module.exports = {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertComment,
  notifyFleetOwner,
  getAlertStatistics,
  getAlertFilterOptions,
};
