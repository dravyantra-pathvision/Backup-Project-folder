// modules/admin/vehicles.service.js
const { pool } = require('../../config/dbconfig');

const paginate = (page, limit) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Number(limit) || 10);
  return {
    offset: (pageNum - 1) * limitNum,
    limit: limitNum,
  };
};

const getAllVehicles = async ({ page = 1, limit = 10, search, type, fuelType, status, organization, fleetOwner } = {}) => {
  const { offset, limit: limitVal } = paginate(page, limit);
  const conditions = ['COALESCE(v.is_deleted, false) = false AND COALESCE(v.status, \'\') != \'Deleted\''];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(v.plate ILIKE $${idx} OR v.device_id ILIKE $${idx} OR v.make ILIKE $${idx} OR v.model ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (type) {
    conditions.push(`v.type = $${idx}`);
    params.push(type);
    idx++;
  }
  if (fuelType) {
    conditions.push(`v.fuel_type = $${idx}`);
    params.push(fuelType);
    idx++;
  }
  if (status) {
    conditions.push(`v.status = $${idx}`);
    params.push(status);
    idx++;
  }
  if (organization) {
    conditions.push(`fo.company_name ILIKE $${idx}`);
    params.push(`%${organization}%`);
    idx++;
  }
  if (fleetOwner) {
    conditions.push(`u.full_name ILIKE $${idx}`);
    params.push(`%${fleetOwner}%`);
    idx++;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) 
    FROM vehicles v
    LEFT JOIN users u ON v.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
    ${whereClause}
  `;

  const dataQuery = `
    SELECT v.*, u.full_name AS fleet_owner_name, u.email AS fleet_owner_email, fo.company_name AS organization_name
    FROM vehicles v
    LEFT JOIN users u ON v.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
    ${whereClause}
    ORDER BY v.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const countRes = await pool.query(countQuery, params);
  const dataRes = await pool.query(dataQuery, [...params, limitVal, offset]);

  return {
    data: dataRes.rows,
    total: Number(countRes.rows[0].count),
    page,
    limit,
  };
};

const getVehicleDetail = async (id) => {
  const query = `
    SELECT v.*, 
           u.full_name AS fleet_owner_name, u.email AS fleet_owner_email, u.phone AS fleet_owner_phone,
           fo.company_name AS organization_name,
           d.name AS driver_name, d.phone AS driver_phone,
           dev.status AS device_status, dev.last_communication
    FROM vehicles v
    LEFT JOIN users u ON v.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
    LEFT JOIN drivers d ON v.driver = d.id
    LEFT JOIN devices dev ON v.device_id = dev.device_id
    WHERE v.plate = $1
  `;
  const res = await pool.query(query, [id]);
  return res.rows[0] || null;
};

const getVehicleAuditLogs = async (plate) => {
  const query = `
    SELECT val.*, u.full_name AS admin_name, u.email AS admin_email
    FROM vehicle_audit_logs val
    LEFT JOIN users u ON val.admin_id = u.uid
    WHERE val.vehicle_plate = $1
    ORDER BY val.created_at DESC
  `;
  const res = await pool.query(query, [plate]);
  return res.rows;
};

const _logAction = async (plate, action, reason, remarks, adminId) => {
  try {
    await pool.query(`
      INSERT INTO vehicle_audit_logs (vehicle_plate, action, reason, remarks, admin_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [plate, action, reason, remarks, adminId]);
  } catch (e) {
    // Non-fatal: audit log failure must never block the core operation
    console.warn('[vehicles] _logAction warning:', e.message);
  }
};

const blockVehicle = async (plate, reason, remarks, adminId) => {
  const query = `UPDATE vehicles SET status = 'Blocked', updated_at = CURRENT_TIMESTAMP WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [plate]);
  if (res.rows.length === 0) throw new Error('Vehicle not found');
  await _logAction(plate, 'Blocked', reason, remarks, adminId);
  return res.rows[0];
};

const suspendVehicle = async (plate, reason, remarks, adminId) => {
  const query = `UPDATE vehicles SET status = 'Suspended', updated_at = CURRENT_TIMESTAMP WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [plate]);
  if (res.rows.length === 0) throw new Error('Vehicle not found');
  await _logAction(plate, 'Suspended', reason, remarks, adminId);
  return res.rows[0];
};

const reactivateVehicle = async (plate, adminId) => {
  const query = `UPDATE vehicles SET status = 'Active', updated_at = CURRENT_TIMESTAMP WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [plate]);
  if (res.rows.length === 0) throw new Error('Vehicle not found');
  await _logAction(plate, 'Reactivated', 'Admin Reactivation', 'Vehicle manually reactivated by admin', adminId);
  return res.rows[0];
};

const _cleanPlate = (id) => {
  if (!id) return '';
  let str = String(id).trim();
  try { str = decodeURIComponent(str).trim(); } catch (_) {}
  return str;
};

const softDeleteVehicle = async (identifier, adminId) => {
  const plateId = _cleanPlate(identifier);
  const checkRes = await pool.query(
    `SELECT plate, is_deleted, status FROM vehicles WHERE TRIM(plate) = $1 OR plate ILIKE $1`,
    [plateId]
  );
  if (checkRes.rows.length === 0) throw new Error('Vehicle not found');
  const vRow = checkRes.rows[0];
  const realPlate = vRow.plate;

  // Only skip if BOTH flags are correctly set (truly in Recycle Bin)
  if (vRow.is_deleted === true && vRow.status === 'Deleted') {
    return { success: true, message: 'Vehicle is already in Recycle Bin' };
  }
  // Handles both fresh deletes AND inconsistent old records (status='Deleted' but is_deleted=false)
  // Preserve the real previous status (never save 'Deleted' as previous_status)
  const query = `UPDATE vehicles SET previous_status = COALESCE(NULLIF(status, 'Deleted'), previous_status, 'Active'), status = 'Deleted', is_deleted = true, deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP) WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [realPlate]);

  await _logAction(realPlate, 'Moved to Recycle Bin', 'Admin Soft Delete', 'Vehicle moved to recycle bin by admin', adminId);
  return res.rows[0];
};

const restoreVehicle = async (identifier, adminId) => {
  const plateId = _cleanPlate(identifier);
  const checkRes = await pool.query(
    `SELECT plate FROM vehicles WHERE TRIM(plate) = $1 OR plate ILIKE $1`,
    [plateId]
  );
  if (checkRes.rows.length === 0) throw new Error('Vehicle not found');
  const realPlate = checkRes.rows[0].plate;

  const query = `UPDATE vehicles SET status = COALESCE(previous_status, 'Active'), is_deleted = false, deleted_at = NULL, previous_status = NULL WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [realPlate]);

  await _logAction(realPlate, 'Restored', 'Admin Restore', 'Vehicle restored from recycle bin', adminId);
  return res.rows[0];
};

const deleteVehiclePermanent = async (identifier, adminId) => {
  const plateId = _cleanPlate(identifier);
  const checkRes = await pool.query(
    `SELECT plate, is_deleted, status FROM vehicles WHERE TRIM(plate) = $1 OR plate ILIKE $1`,
    [plateId]
  );
  if (checkRes.rows.length === 0) throw new Error('Vehicle not found');
  const vRow = checkRes.rows[0];
  if (!vRow.is_deleted && vRow.status !== 'Deleted') {
    const err = new Error('Vehicle must be moved to Recycle Bin before permanent deletion.');
    err.statusCode = 409;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Unassign IoT device from vehicle (devices.assigned_vehicle -> SET NULL)
    await client.query(`UPDATE devices SET assigned_vehicle = NULL WHERE assigned_vehicle = $1`, [vRow.plate]);

    // 2. Delete vehicle master record by primary key (plate)
    await client.query(`DELETE FROM vehicles WHERE plate = $1`, [vRow.plate]);

    await client.query('COMMIT');
    return { success: true, message: 'Vehicle master record permanently deleted. Historical telemetry retained.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllVehicles,
  getVehicleDetail,
  getVehicleAuditLogs,
  blockVehicle,
  suspendVehicle,
  reactivateVehicle,
  softDeleteVehicle,
  restoreVehicle,
  deleteVehiclePermanent,
};

