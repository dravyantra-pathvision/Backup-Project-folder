// modules/admin/admin.service.js
// Business logic for all admin operations.
// Queries run across ALL organizations — no org_id filter (admin sees everything).

const { pool } = require('../../config/dbconfig');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

const getDashboardStats = async () => {
  const [
    orgCountRes,
    ownerCountRes,
    vehicleCountRes,
    driverCountRes,
    tripCountRes,
    deviceCountRes,
    alertCountRes,
    subCountRes,
    recentOrgsRes,
    recentAlertsRes,
    recentOwnersRes
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM fleet_onboarding`),
    pool.query(`SELECT COUNT(*) FROM users u INNER JOIN fleet_onboarding fo ON u.uid = fo.uid WHERE u.role = 'fleet_owner' AND fo.status = 'Approved'`),
    pool.query(`SELECT COUNT(*) FROM vehicles`),
    pool.query(`SELECT COUNT(*) FROM drivers`),
    pool.query(`SELECT COUNT(*) FROM trips WHERE trip_completed = false`),
    pool.query(`SELECT COUNT(*) FROM vehicles WHERE is_active = true`),
    pool.query(`SELECT COUNT(*) FROM alerts WHERE severity = 'critical'`),
    pool.query(`SELECT COUNT(*) FROM report_schedules WHERE is_active = true`),
    
    // 5 most recent organizations
    pool.query(`
      SELECT f.id, f.company_name AS name, u.email AS "adminEmail", 
             (SELECT COUNT(*) FROM vehicles v WHERE v.uid = f.uid) AS "vehicleCount", 
             'Active' AS status 
      FROM fleet_onboarding f 
      JOIN users u ON f.uid = u.uid 
      ORDER BY f.created_at DESC LIMIT 5
    `),

    // 5 most recent alerts
    pool.query(`
      SELECT id::text, message, vehicle_plate AS "vehicleId", severity, TO_CHAR(detected_at, 'HH12:MI AM') AS time
      FROM alerts 
      ORDER BY detected_at DESC LIMIT 5
    `),

    // 5 most recent fleet owners — only truly approved/onboarded owners
    pool.query(`
      SELECT u.uid AS id, u.full_name AS name, u.email, COALESCE(f.company_name, 'N/A') AS organization, TO_CHAR(u.created_at, 'YYYY-MM-DD') AS "joinedDate", f.status AS status
      FROM users u 
      INNER JOIN fleet_onboarding f ON u.uid = f.uid 
      WHERE u.role = 'fleet_owner' AND f.status = 'Approved'
      ORDER BY f.submission_date DESC LIMIT 5
    `)
  ]);

  return {
    statistics: {
      totalOrganizations: parseInt(orgCountRes.rows[0].count, 10),
      totalFleetOwners: parseInt(ownerCountRes.rows[0].count, 10),
      totalVehicles: parseInt(vehicleCountRes.rows[0].count, 10),
      totalDrivers: parseInt(driverCountRes.rows[0].count, 10),
      activeTrips: parseInt(tripCountRes.rows[0].count, 10),
      onlineDevices: parseInt(deviceCountRes.rows[0].count, 10),
      criticalAlerts: parseInt(alertCountRes.rows[0].count, 10),
      activeSubscriptions: parseInt(subCountRes.rows[0].count, 10),
    },
    recentOrganizations: recentOrgsRes.rows,
    recentAlerts: recentAlertsRes.rows,
    recentFleetOwners: recentOwnersRes.rows,
  };
};


// ── Fleet Owners ──────────────────────────────────────────────────────────────

const getAllFleetOwners = async ({ page, limit, search, status, orgStatus }) => {
  const { offset } = paginate(page, limit);
  const params = [];
  // Fleet Owners tab = users who are fully onboarded (org status = 'Approved').
  // Users who are still in Draft / Pending / Rejected belong in the Organizations tab, not here.
  let where = `WHERE u.role = 'fleet_owner' AND fo.status = 'Approved'`;
  let idx = 1;

  if (search) {
    where += ` AND (u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR fo.company_name ILIKE $${idx})`;
    params.push(`%${search}%`); idx++;
  }
  
  if (status) {
    where += ` AND u.account_status = $${idx}`;
    params.push(status); idx++;
  } else {
    // By default, exclude soft-deleted accounts unless status filter is explicitly requested
    where += ` AND u.account_status != 'Deleted'`;
  }

  // orgStatus filter is kept for API flexibility but only applies within Approved orgs
  if (orgStatus && orgStatus !== 'Approved') {
    // If admin explicitly filters by a non-Approved org status, return empty
    // (those belong in the Organizations tab)
    return { data: [], total: 0, page, limit };
  }

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM users u INNER JOIN fleet_onboarding fo ON u.uid = fo.uid ${where}`,
    params
  );
  const dataRes = await pool.query(
    `SELECT u.uid, u.email, u.full_name, COALESCE(u.phone, fo.contact_number) AS phone, u.created_at, u.account_status,
            fo.id AS organization_id, fo.company_name, fo.contact_number, fo.city, fo.state, fo.pan, fo.gstin, fo.fleet_size, fo.industry_type, fo.status AS organization_status,
            (SELECT COUNT(*) FROM vehicles v WHERE v.uid = u.uid) AS vehicle_count,
            (SELECT COUNT(*) FROM drivers d WHERE d.uid = u.uid) AS driver_count
     FROM users u
     INNER JOIN fleet_onboarding fo ON u.uid = fo.uid
     ${where}
     ORDER BY fo.submission_date DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
};

const getFleetOwnerDetail = async (uid) => {
  const [user, org, vehicles, drivers, trips, auditLogs] = await Promise.all([
    pool.query(`SELECT uid, email, full_name, COALESCE(phone, (SELECT contact_number FROM fleet_onboarding WHERE uid = $1 LIMIT 1)) AS phone, role, created_at, account_status FROM users WHERE uid = $1`, [uid]),
    pool.query(`SELECT * FROM fleet_onboarding WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active=true) AS active FROM vehicles WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total FROM drivers WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total FROM trips WHERE uid = $1`, [uid]),
    pool.query(`
      SELECT oal.*, u.full_name AS admin_name 
      FROM organization_audit_logs oal 
      LEFT JOIN users u ON oal.admin_id = u.uid 
      WHERE organization_id = (SELECT id FROM fleet_onboarding WHERE uid = $1 LIMIT 1)
      ORDER BY created_at DESC LIMIT 10
    `, [uid])
  ]);

  if (user.rows.length === 0) return null;

  return {
    user: user.rows[0],
    org: org.rows[0] || null,
    vehicles: vehicles.rows[0],
    drivers: drivers.rows[0],
    trips: trips.rows[0],
    auditLogs: auditLogs.rows,
  };
};

const updateFleetOwner = async (uid, fields) => {
  const { full_name, phone, email, organization_name, organization_status, account_status } = fields;
  
  const userRes = await pool.query(
    `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), email = COALESCE($3, email), account_status = COALESCE($4, account_status) WHERE uid = $5 RETURNING *`,
    [full_name, phone, email, account_status, uid]
  );
  if (userRes.rows.length === 0) throw new Error('Fleet Owner not found');

  if (organization_name || organization_status) {
    await pool.query(
      `UPDATE fleet_onboarding SET company_name = COALESCE($1, company_name), status = COALESCE($2, status) WHERE uid = $3`,
      [organization_name, organization_status, uid]
    );
  }
  return userRes.rows[0];
};

const updateFleetOwnerStatus = async (uid, status, adminId) => {
  const userRes = await pool.query(
    `UPDATE users SET account_status = $1 WHERE uid = $2 RETURNING *`,
    [status, uid]
  );
  if (userRes.rows.length === 0) throw new Error('Fleet Owner not found');

  const orgRes = await pool.query(`SELECT id FROM fleet_onboarding WHERE uid = $1`, [uid]);
  if (orgRes.rows.length > 0) {
    const orgId = orgRes.rows[0].id;
    await pool.query(
      `INSERT INTO organization_audit_logs (organization_id, action, admin_id, reason) VALUES ($1, $2, $3, $4)`,
      [orgId, `User ${status}`, adminId, `Admin updated fleet owner account status to ${status}`]
    );
  }
  return userRes.rows[0];
};

const deleteFleetOwner = async (uid, adminId) => {
  return updateFleetOwnerStatus(uid, 'Deleted', adminId);
};

const hardDeleteFleetOwner = async (uid, adminId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const safeExec = async (sql, args = []) => {
      try {
        await client.query('SAVEPOINT sp');
        await client.query(sql, args);
        await client.query('RELEASE SAVEPOINT sp');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
      }
    };

    // 1. Organization audit logs
    await safeExec(
      'DELETE FROM organization_audit_logs WHERE organization_id IN (SELECT id FROM fleet_onboarding WHERE uid = $1)',
      [uid]
    );

    // 2. Vehicle audit logs & telemetry
    await safeExec(
      'DELETE FROM vehicle_audit_logs WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)',
      [uid]
    );
    await safeExec(
      'DELETE FROM telemetry_history WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)',
      [uid]
    );
    await safeExec(
      'DELETE FROM live_telemetry WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)',
      [uid]
    );

    // 3. Fuel logs
    await safeExec('DELETE FROM fuel_logs WHERE uid = $1', [uid]);

    // 4. Support tickets & replies
    await safeExec(
      'DELETE FROM support_ticket_replies WHERE ticket_id IN (SELECT id FROM support_tickets WHERE uid = $1)',
      [uid]
    );
    await safeExec('DELETE FROM support_tickets WHERE uid = $1', [uid]);

    // 5. Reports & Schedules
    await safeExec('DELETE FROM report_history WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM report_schedules WHERE uid = $1', [uid]);

    // 6. Unassign Devices
    await safeExec(
      'UPDATE devices SET assigned_vehicle_id = NULL, status = \'unassigned\' WHERE assigned_vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)',
      [uid]
    );

    // 7. Activity logs, Fleet settings, Alerts, Trips
    await safeExec('DELETE FROM activity_logs WHERE user_id = $1', [uid]);
    await safeExec('DELETE FROM fleet_settings WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM alerts WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM trips WHERE uid = $1', [uid]);

    // 8. Primary Entities: vehicles, drivers, onboarding, notifications
    await safeExec('DELETE FROM vehicles WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM drivers WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM fleet_onboarding WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM notifications WHERE uid = $1', [uid]);

    // 9. Users Table
    await client.query('DELETE FROM users WHERE uid = $1', [uid]);
    
    await client.query('COMMIT');
    
    // 10. Firebase Auth User Deletion
    try {
      const adminFirebase = require('../../config/firebase');
      await adminFirebase.auth().deleteUser(uid);
    } catch (fbErr) {
      console.warn(`Firebase user deletion warning for ${uid}:`, fbErr.message);
    }
    
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error in hardDeleteFleetOwner for ${uid}:`, err);
    throw err;
  } finally {
    client.release();
  }
};

const resetFleetOwnerPassword = async (uid) => {
  const adminFirebase = require('../../config/firebase');
  const userRes = await pool.query(`SELECT email FROM users WHERE uid = $1`, [uid]);
  if (userRes.rows.length === 0) throw new Error('Fleet Owner not found');
  const email = userRes.rows[0].email;
  const link = await adminFirebase.auth().generatePasswordResetLink(email);
  return link;
};

// ── Organizations ─────────────────────────────────────────────────────────────

const getAllOrganizations = async ({ page, limit, search, status }) => {
  const { offset } = paginate(page, limit);
  const params = [];
  const conditions = [];
  let idx = 1;

  if (search) {
    conditions.push(`(company_name ILIKE $${idx} OR city ILIKE $${idx} OR organization_name ILIKE $${idx})`);
    params.push(`%${search}%`); 
    idx++;
  }
  
  if (status) {
    conditions.push(`status = $${idx}`);
    params.push(status);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*) FROM fleet_onboarding ${where}`, params);
  const dataRes  = await pool.query(
    `SELECT fo.*, u.email, u.full_name, COALESCE(u.phone, fo.contact_number) AS phone, u.role, u.account_status,
            (SELECT COUNT(*) FROM vehicles v WHERE v.uid = fo.uid) AS vehicle_count,
            (SELECT COUNT(*) FROM drivers d WHERE d.uid = fo.uid) AS driver_count
     FROM fleet_onboarding fo
     LEFT JOIN users u ON fo.uid = u.uid
     ${where}
     ORDER BY fo.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
};

const getOrganizationDetail = async (uid) => {
  const [org, user, vehicles, drivers, trips] = await Promise.all([
    pool.query(`SELECT * FROM fleet_onboarding WHERE uid = $1`, [uid]),
    pool.query(`SELECT uid, email, full_name, COALESCE(phone, (SELECT contact_number FROM fleet_onboarding WHERE uid = $1 LIMIT 1)) AS phone, role, created_at, account_status FROM users WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status='active') AS active FROM vehicles WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total FROM drivers WHERE uid = $1`, [uid]),
    pool.query(`SELECT COUNT(*) AS total FROM trips WHERE uid = $1`, [uid]),
  ]);

  if (org.rows.length === 0) return null;
  
  const orgId = org.rows[0].id;
  const auditLogs = await pool.query(`
    SELECT oal.*, u.full_name AS admin_name 
    FROM organization_audit_logs oal 
    LEFT JOIN users u ON oal.admin_id = u.uid 
    WHERE organization_id = $1 
    ORDER BY created_at DESC
  `, [orgId]);

  return {
    org:      org.rows[0],
    user:     user.rows[0] || null,
    vehicles: vehicles.rows[0],
    drivers:  drivers.rows[0],
    trips:    trips.rows[0],
    auditLogs: auditLogs.rows,
  };
};

const updateOrganizationStatus = async (id, status, reason, adminId) => {
  const result = await pool.query(
    `UPDATE fleet_onboarding SET status = $1, rejection_reason = $2, last_updated = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
    [status, reason || null, id]
  );
  
  if (result.rows.length === 0) throw new Error('Organization not found');
  
  await pool.query(
    `INSERT INTO organization_audit_logs (organization_id, action, admin_id, reason) VALUES ($1, $2, $3, $4)`,
    [id, status, adminId, reason || `Organization ${status.toLowerCase()}`]
  );

  // Send a notification to the owner
  const uid = result.rows[0].uid;
  await pool.query(
    `INSERT INTO notifications (uid, title, message, type) VALUES ($1, $2, $3, $4)`,
    [uid, `Organization ${status}`, `Your organization profile has been ${status.toLowerCase()}. ${reason ? 'Reason: ' + reason : ''}`, 'Organization']
  );

  return result.rows[0];
};

// ── Vehicles ──────────────────────────────────────────────────────────────────
// Vehicle management has been moved to vehicles.service.js

// ── Drivers ───────────────────────────────────────────────────────────────────

const getAllDrivers = async ({ page, limit, search }) => {
  const { offset } = paginate(page, limit);
  const params = [];
  let where = '';
  let idx = 1;

  if (search) {
    where = `WHERE d.name ILIKE $${idx} OR d.phone ILIKE $${idx} OR d.license_number ILIKE $${idx}`;
    params.push(`%${search}%`); idx++;
  }

  const countRes = await pool.query(`SELECT COUNT(*) FROM drivers d ${where}`, params);
  const dataRes  = await pool.query(
    `SELECT d.*, u.email AS owner_email, u.full_name AS owner_name
     FROM drivers d
     LEFT JOIN users u ON d.uid = u.uid
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
};

// ── Trips ─────────────────────────────────────────────────────────────────────

const getAllTrips = async ({ page, limit }) => {
  const { offset } = paginate(page, limit);

  const countRes = await pool.query(`SELECT COUNT(*) FROM trips`);
  const dataRes  = await pool.query(
    `SELECT t.*, u.email AS owner_email
     FROM trips t
     LEFT JOIN users u ON t.uid = u.uid
     ORDER BY t.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
};

// ── Alerts ────────────────────────────────────────────────────────────────────

const getAllAlerts = async ({ page, limit, type }) => {
  const { offset } = paginate(page, limit);
  const params = [];
  let where = '';
  let idx = 1;

  if (type) { where = `WHERE type = $${idx++}`; params.push(type); }

  const countRes = await pool.query(`SELECT COUNT(*) FROM alerts ${where}`, params);
  const dataRes  = await pool.query(
    `SELECT a.*, u.email AS owner_email
     FROM alerts a
     LEFT JOIN users u ON a.uid = u.uid
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
};

// ── Reports ───────────────────────────────────────────────────────────────────

const getReports = async ({ from_date, to_date }) => {
  const params = [];
  let dateFilter = '';
  let idx = 1;

  if (from_date) { dateFilter += ` AND created_at >= $${idx++}`; params.push(from_date); }
  if (to_date)   { dateFilter += ` AND created_at <= $${idx++}`; params.push(to_date); }

  const [trips, fuel, alerts] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total, SUM(total_distance_km) AS total_distance FROM trips WHERE 1=1 ${dateFilter}`, params),
    pool.query(`SELECT COUNT(*) AS total_logs, SUM(quantity_liters) AS total_liters FROM fuel_logs WHERE 1=1 ${dateFilter}`, params),
    pool.query(`SELECT type, COUNT(*) AS count FROM alerts WHERE 1=1 ${dateFilter} GROUP BY type`, params),
  ]);

  return {
    trips:  trips.rows[0],
    fuel:   fuel.rows[0],
    alerts: alerts.rows,
  };
};

// ── Analytics ─────────────────────────────────────────────────────────────────

const getAnalytics = async ({ period = '30' }) => {
  const days = parseInt(period, 10) || 30;

  const [tripsByDay, fuelByDay, alertsByType] = await Promise.all([
    pool.query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS trips
       FROM trips
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    ),
    pool.query(
      `SELECT DATE(log_date) AS date, SUM(quantity_liters) AS liters
       FROM fuel_logs
       WHERE log_date >= NOW() - INTERVAL '${days} days'
       GROUP BY DATE(log_date)
       ORDER BY date ASC`
    ),
    pool.query(
      `SELECT type, COUNT(*) AS count
       FROM alerts
       WHERE created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY type`
    ),
  ]);

  return {
    period_days: days,
    trips_by_day:   tripsByDay.rows,
    fuel_by_day:    fuelByDay.rows,
    alerts_by_type: alertsByType.rows,
  };
};

// ── Settings ──────────────────────────────────────────────────────────────────
// Placeholder — extend with a system_settings table in a future phase.

const getSettings = async () => {
  return {
    app_name:       'DravYantra',
    version:        '1.0.0',
    maintenance_mode: false,
  };
};

const updateSettings = async (settings) => {
  // TODO: Persist to system_settings table (Phase 5)
  return settings;
};

// ── Activity Logs ─────────────────────────────────────────────────────────────
// Placeholder — queries activity_logs table once created in Phase 5.

const getActivityLogs = async ({ page, limit }) => {
  const { offset } = paginate(page, limit);
  try {
    const countRes = await pool.query(`SELECT COUNT(*) FROM activity_logs`);
    const dataRes  = await pool.query(
      `SELECT al.*, u.email FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.uid
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { data: dataRes.rows, total: Number(countRes.rows[0].count), page, limit };
  } catch {
    // activity_logs table not yet created — return empty gracefully
    return { data: [], total: 0, page, limit, note: 'activity_logs table not yet created' };
  }
};

const hardDeleteOrganization = async (id, adminId) => {
  // id here is fleet_onboarding.id (org id)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const safeExec = async (sql, args = []) => {
      try {
        await client.query('SAVEPOINT sp');
        await client.query(sql, args);
        await client.query('RELEASE SAVEPOINT sp');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
      }
    };

    // Get the uid for this org
    const orgRes = await client.query('SELECT uid FROM fleet_onboarding WHERE id = $1', [id]);
    if (orgRes.rows.length === 0) throw new Error('Organization not found');
    const uid = orgRes.rows[0].uid;

    // Cascade deletes — same as hardDeleteFleetOwner but triggered by org id
    await safeExec('DELETE FROM organization_audit_logs WHERE organization_id = $1', [id]);
    await safeExec('DELETE FROM vehicle_audit_logs WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)', [uid]);
    await safeExec('DELETE FROM telemetry_history WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)', [uid]);
    await safeExec('DELETE FROM live_telemetry WHERE vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)', [uid]);
    await safeExec('DELETE FROM fuel_logs WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM support_ticket_replies WHERE ticket_id IN (SELECT id FROM support_tickets WHERE uid = $1)', [uid]);
    await safeExec('DELETE FROM support_tickets WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM report_history WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM report_schedules WHERE uid = $1', [uid]);
    await safeExec('UPDATE devices SET assigned_vehicle_id = NULL, status = \'unassigned\' WHERE assigned_vehicle_id IN (SELECT id FROM vehicles WHERE uid = $1)', [uid]);
    await safeExec('DELETE FROM activity_logs WHERE user_id = $1', [uid]);
    await safeExec('DELETE FROM fleet_settings WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM alerts WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM trips WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM vehicles WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM drivers WHERE uid = $1', [uid]);
    await safeExec('DELETE FROM notifications WHERE uid = $1', [uid]);
    await client.query('DELETE FROM fleet_onboarding WHERE id = $1', [id]);
    await safeExec('DELETE FROM users WHERE uid = $1', [uid]);

    await client.query('COMMIT');

    // Firebase cleanup
    try {
      const adminFirebase = require('../../config/firebase');
      await adminFirebase.auth().deleteUser(uid);
    } catch (fbErr) {
      console.warn(`Firebase user deletion warning for ${uid}:`, fbErr.message);
    }

    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardStats,
  getAllFleetOwners,
  getFleetOwnerDetail,
  updateFleetOwner,
  updateFleetOwnerStatus,
  deleteFleetOwner,
  hardDeleteFleetOwner,
  hardDeleteOrganization,
  resetFleetOwnerPassword,
  getAllOrganizations,
  getOrganizationDetail,
  updateOrganizationStatus,
  getAllDrivers,
  getAllAlerts,
  getReports,
  getAnalytics,
  getSettings,
  updateSettings,
  getActivityLogs,
};

