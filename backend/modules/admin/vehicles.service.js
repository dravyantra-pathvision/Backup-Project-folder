// modules/admin/vehicles.service.js
const { pool } = require('../../config/dbconfig');

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

const getAllVehicles = async ({ page, limit, search, type, fuelType, status, organization, fleetOwner }) => {
  const { offset } = paginate(page, limit);
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
  const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

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
  await pool.query(`
    INSERT INTO vehicle_audit_logs (vehicle_plate, action, reason, remarks, admin_id)
    VALUES ($1, $2, $3, $4, $5)
  `, [plate, action, reason, remarks, adminId]);
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

const deleteVehiclePermanent = async (plate, adminId) => {
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

    // Get vehicle id first
    const vRes = await client.query('SELECT id FROM vehicles WHERE plate = $1', [plate]);
    if (vRes.rows.length === 0) throw new Error('Vehicle not found');
    const vehicleId = vRes.rows[0].id;

    // Cascade deletes
    await safeExec('DELETE FROM vehicle_audit_logs WHERE vehicle_id = $1', [vehicleId]);
    await safeExec('DELETE FROM telemetry_history WHERE vehicle_id = $1', [vehicleId]);
    await safeExec('DELETE FROM live_telemetry WHERE vehicle_id = $1', [vehicleId]);
    await safeExec('UPDATE devices SET assigned_vehicle_id = NULL, status = \'unassigned\' WHERE assigned_vehicle_id = $1', [vehicleId]);
    await safeExec('DELETE FROM alerts WHERE vehicle_plate = $1', [plate]);
    await safeExec('DELETE FROM trips WHERE vehicle = $1', [plate]);
    await safeExec('DELETE FROM fuel_logs WHERE vehicle_plate = $1', [plate]);

    // Delete the vehicle
    await client.query('DELETE FROM vehicles WHERE plate = $1', [plate]);

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const softDeleteVehicle = async (plate, adminId) => {
  const query = `UPDATE vehicles SET is_deleted = true, status = 'Deleted', deleted_at = CURRENT_TIMESTAMP WHERE plate = $1 RETURNING *`;
  const res = await pool.query(query, [plate]);
  if (res.rows.length === 0) throw new Error('Vehicle not found');
  await _logAction(plate, 'Moved to Recycle Bin', 'Admin Soft Delete', 'Vehicle moved to recycle bin by admin', adminId);
  return res.rows[0];
};

module.exports = {
  getAllVehicles,
  getVehicleDetail,
  getVehicleAuditLogs,
  blockVehicle,
  suspendVehicle,
  reactivateVehicle,
  softDeleteVehicle,
  deleteVehiclePermanent,
};

