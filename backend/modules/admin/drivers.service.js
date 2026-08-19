const { pool } = require('../../config/dbconfig');

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

const getAllDrivers = async (filters, page = 1, limit = 10) => {
  const { offset, limit: limitVal } = paginate(page, limit);
  let query = `
    SELECT 
      d.id, d.uid, d.name, d.phone, d.lic, d.lic_exp, d.vehicle, d.status,
      d.created_at, u.full_name as owner_name, u.email as owner_email,
      f.company_name,
      d.is_active, d.on_leave
    FROM drivers d
    LEFT JOIN users u ON d.uid = u.uid
    LEFT JOIN fleet_onboarding f ON u.uid = f.uid
    WHERE COALESCE(d.is_deleted, false) = false AND COALESCE(d.status, '') != 'Deleted'
  `;
  const values = [];
  let index = 1;

  if (filters.search) {
    query += ` AND (d.name ILIKE $${index} OR d.lic ILIKE $${index} OR d.phone ILIKE $${index} OR f.company_name ILIKE $${index} OR d.vehicle ILIKE $${index})`;
    values.push(`%${filters.search}%`);
    index++;
  }

  if (filters.organization) {
    query += ` AND f.company_name ILIKE $${index}`;
    values.push(`%${filters.organization}%`);
    index++;
  }
  
  if (filters.fleetOwner) {
    query += ` AND u.uid = $${index}`;
    values.push(filters.fleetOwner);
    index++;
  }

  if (filters.status) {
    query += ` AND d.status = $${index}`;
    values.push(filters.status);
    index++;
  }

  // Count query before pagination
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS subquery`;
  const countRes = await pool.query(countQuery, values);
  const total = parseInt(countRes.rows[0].count, 10);

  query += ` ORDER BY d.created_at DESC LIMIT $${index} OFFSET $${index + 1}`;
  values.push(limitVal, offset);

  const res = await pool.query(query, values);

  return {
    drivers: res.rows,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / limitVal),
  };
};

const getDriverById = async (driverId) => {
  const query = `
    SELECT 
      d.*, 
      u.full_name as owner_name, 
      u.email as owner_email,
      f.company_name
    FROM drivers d
    LEFT JOIN users u ON d.uid = u.uid
    LEFT JOIN fleet_onboarding f ON u.uid = f.uid
    WHERE d.id = $1
  `;
  const res = await pool.query(query, [driverId]);
  
  if (res.rows.length === 0) {
    throw new Error('Driver not found');
  }

  const driver = res.rows[0];

  // Also fetch the driver's audit log
  const auditQuery = `
    SELECT * FROM admin_audit_logs 
    WHERE target_id = $1 AND target_type = 'DRIVER'
    ORDER BY created_at DESC
  `;
  // We might not have admin_audit_logs table, let's gracefully handle it
  let auditLogs = [];
  try {
    const auditRes = await pool.query(auditQuery, [driverId]);
    auditLogs = auditRes.rows;
  } catch (e) {
    // Table might not exist, skip
  }

  return { ...driver, auditLogs };
};

const updateDriverStatus = async (driverId, status, remarks, adminUid) => {
  const allowedStatuses = ['Active', 'Suspended'];
  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  const checkRes = await pool.query(`SELECT status FROM drivers WHERE id = $1`, [driverId]);
  if (checkRes.rows.length === 0) {
    throw new Error('Driver not found');
  }

  // Update status
  const updateQuery = `
    UPDATE drivers 
    SET status = $1, is_active = $2
    WHERE id = $3
    RETURNING id
  `;
  // If suspended, is_active is false
  const isActive = status === 'Active';
  await pool.query(updateQuery, [status, isActive, driverId]);

  // Insert audit log if table exists
  try {
    const auditInsert = `
      INSERT INTO admin_audit_logs (admin_uid, target_type, target_id, action, remarks, created_at)
      VALUES ($1, 'DRIVER', $2, $3, $4, CURRENT_TIMESTAMP)
    `;
    await pool.query(auditInsert, [adminUid, status === 'Suspended' ? 'SUSPEND' : 'REACTIVATE', driverId, remarks]);
  } catch (e) {
    // Ignore if table doesn't exist
  }

  return { success: true, message: `Driver status updated to ${status}` };
};

const getDriversExport = async (filters) => {
  let query = `
    SELECT 
      d.id as "Driver ID",
      d.name as "Driver Name",
      d.phone as "Phone",
      d.lic as "License Number",
      d.lic_exp as "License Expiry",
      f.company_name as "Organization",
      u.full_name as "Fleet Owner",
      d.vehicle as "Assigned Vehicle",
      d.status as "Status",
      d.created_at as "Created At"
    FROM drivers d
    LEFT JOIN users u ON d.uid = u.uid
    LEFT JOIN fleet_onboarding f ON u.uid = f.uid
    WHERE 1=1
  `;
  const values = [];
  let index = 1;

  if (filters.organization) {
    query += ` AND f.company_name ILIKE $${index}`;
    values.push(`%${filters.organization}%`);
    index++;
  }
  
  if (filters.status) {
    query += ` AND d.status = $${index}`;
    values.push(filters.status);
    index++;
  }

  query += ' ORDER BY d.created_at DESC';

  const res = await pool.query(query, values);
  return res.rows;
};

const softDeleteDriver = async (id, adminId) => {
  const checkRes = await pool.query(`SELECT status FROM drivers WHERE id = $1`, [id]);
  if (checkRes.rows.length === 0) throw new Error('Driver not found');
  const currentStatus = checkRes.rows[0].status;

  const query = `UPDATE drivers SET previous_status = status, status = 'Deleted', is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
  const res = await pool.query(query, [id]);
  return res.rows[0];
};

const restoreDriver = async (id, adminId) => {
  const query = `UPDATE drivers SET status = COALESCE(previous_status, 'idle'), is_deleted = false, deleted_at = NULL, previous_status = NULL WHERE id = $1 RETURNING *`;
  const res = await pool.query(query, [id]);
  if (res.rows.length === 0) throw new Error('Driver not found');
  return res.rows[0];
};

const deleteDriverPermanent = async (id, adminId) => {
  // Level 3 Guard Check: Verify driver is in Recycle Bin
  const checkRes = await pool.query(`SELECT id, is_deleted, status FROM drivers WHERE id = $1`, [id]);
  if (checkRes.rows.length === 0) throw new Error('Driver not found');
  const dRow = checkRes.rows[0];
  if (!dRow.is_deleted && dRow.status !== 'Deleted') {
    const err = new Error('Driver must be moved to Recycle Bin before permanent deletion.');
    err.statusCode = 409;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Delete driver master record (drivers.id)
    await client.query('DELETE FROM drivers WHERE id = $1', [id]);

    await client.query('COMMIT');
    return { success: true, message: 'Driver master record permanently deleted. Historical trip logs retained.' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  updateDriverStatus,
  getDriversExport,
  softDeleteDriver,
  restoreDriver,
  deleteDriverPermanent,
};
