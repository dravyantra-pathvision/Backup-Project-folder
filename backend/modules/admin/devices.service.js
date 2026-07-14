const { pool } = require('../../config/dbconfig');

/**
 * Register a new hardware device (Admin only)
 */
const registerDevice = async (data, adminUid) => {
  const {
    device_id, serial_number, firmware_version, hardware_version,
    device_type, manufacturer, mac_address, imei, sim_number,
    gps_module, fuel_sensor, accelerometer
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create Device
    await client.query(
      `INSERT INTO devices (
         device_id, serial_number, firmware_version, hardware_version,
         device_type, manufacturer, mac_address, imei, sim_number,
         gps_module, fuel_sensor, accelerometer, status, created_by, qr_code
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'Available', $13, $14)`,
      [
        device_id, serial_number, firmware_version, hardware_version,
        device_type, manufacturer, mac_address, imei, sim_number,
        gps_module, fuel_sensor, accelerometer || false, adminUid,
        device_id // QR code is just the device_id as per spec
      ]
    );

    // Audit Log
    await client.query(
      `INSERT INTO device_audit_logs (device_id, admin_uid, action, remarks)
       VALUES ($1, $2, 'Device Registered', 'Device provisioned by system admin')`,
      [device_id, adminUid]
    );

    await client.query('COMMIT');
    return { device_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get all devices with filtering and pagination
 */
const getAllDevices = async ({ page = 1, limit = 50, search, status, manufacturer, firmware }) => {
  const offset = (page - 1) * limit;
  const values = [];
  let conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(d.device_id ILIKE $${values.length} OR d.serial_number ILIKE $${values.length})`);
  }
  if (status) {
    values.push(status);
    conditions.push(`d.status = $${values.length}`);
  }
  if (manufacturer) {
    values.push(manufacturer);
    conditions.push(`d.manufacturer = $${values.length}`);
  }
  if (firmware) {
    values.push(firmware);
    conditions.push(`d.firmware_version = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const countQuery = `SELECT COUNT(*) FROM devices d ${whereClause}`;
  const dataQuery = `
    SELECT d.*, v.type as vehicle_model, o.company_name as org_name 
    FROM devices d
    LEFT JOIN vehicles v ON d.assigned_vehicle = v.plate
    LEFT JOIN fleet_onboarding o ON d.assigned_organization = o.uid
    ${whereClause} 
    ORDER BY d.created_at DESC 
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;

  const countRes = await pool.query(countQuery, values);
  const dataRes = await pool.query(dataQuery, [...values, limit, offset]);

  return {
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count, 10),
    page: Number(page),
    limit: Number(limit)
  };
};

/**
 * Get detailed info about a specific device
 */
const getDeviceDetail = async (deviceId) => {
  const deviceRes = await pool.query(`
    SELECT d.*, v.type as vehicle_model, o.company_name as org_name 
    FROM devices d
    LEFT JOIN vehicles v ON d.assigned_vehicle = v.plate
    LEFT JOIN fleet_onboarding o ON d.assigned_organization = o.uid
    WHERE d.device_id = $1
  `, [deviceId]);
  
  if (deviceRes.rows.length === 0) return null;

  const logsRes = await pool.query(`
    SELECT l.*, u.full_name as admin_name 
    FROM device_audit_logs l
    LEFT JOIN users u ON l.admin_uid = u.uid
    WHERE l.device_id = $1
    ORDER BY l.created_at DESC
  `, [deviceId]);

  return {
    ...deviceRes.rows[0],
    audit_logs: logsRes.rows
  };
};

/**
 * Update device metadata
 */
const updateDevice = async (deviceId, data, adminUid) => {
  const { firmware_version, hardware_version, status } = data;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update Device
    const fields = [];
    const values = [];
    let idx = 1;
    
    if (firmware_version) {
      fields.push(`firmware_version = $${idx++}`);
      values.push(firmware_version);
    }
    if (hardware_version) {
      fields.push(`hardware_version = $${idx++}`);
      values.push(hardware_version);
    }
    if (status) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }
    
    if (fields.length === 0) throw new Error('No valid fields to update');
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(deviceId);
    
    const query = `UPDATE devices SET ${fields.join(', ')} WHERE device_id = $${idx} RETURNING *`;
    const res = await client.query(query, values);
    
    if (res.rows.length === 0) {
      throw new Error('Device not found');
    }

    // Audit Log
    await client.query(
      `INSERT INTO device_audit_logs (device_id, admin_uid, action, remarks)
       VALUES ($1, $2, 'Device Edited', 'Admin updated device metadata')`,
      [deviceId, adminUid]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Update device status (e.g. Maintenance, Retire)
 */
const updateDeviceStatus = async (deviceId, status, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const res = await client.query(
      `UPDATE devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2 RETURNING *`,
      [status, deviceId]
    );
    
    if (res.rows.length === 0) {
      throw new Error('Device not found');
    }

    await client.query(
      `INSERT INTO device_audit_logs (device_id, admin_uid, action, remarks)
       VALUES ($1, $2, 'Status Changed', $3)`,
      [deviceId, adminUid, `Status changed to ${status}`]
    );

    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Delete a device
 */
const deleteDevice = async (deviceId, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Clear vehicle assignment if any
    await client.query(
      `UPDATE vehicles SET device_id = NULL WHERE device_id = $1`,
      [deviceId]
    );
    
    await client.query(
      `DELETE FROM devices WHERE device_id = $1 RETURNING *`,
      [deviceId]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  registerDevice,
  getAllDevices,
  getDeviceDetail,
  updateDevice,
  updateDeviceStatus,
  deleteDevice
};
