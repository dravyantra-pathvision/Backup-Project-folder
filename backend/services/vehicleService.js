// services/vehicleService.js
// Extracted SQL operations for L101-156 of index.js
const { pool } = require('../config/dbconfig');

const getAllVehicles = async (uid) => {
  const result = await pool.query(
    'SELECT * FROM vehicles WHERE uid = $1',
    [uid]
  );
  return result.rows;
};

const getAvailableVehicles = async (uid) => {
  const result = await pool.query(
    `SELECT * FROM vehicles v WHERE v.uid = $1
       AND NOT EXISTS (
         SELECT 1 FROM trips t WHERE t.uid = $1 AND t.vehicle = v.plate AND (t.trip_completed IS NOT TRUE AND LOWER(COALESCE(t.status, '')) IN ('active', 'in progress', 'running'))
       )
     ORDER BY v.plate ASC`,
    [uid]
  );
  return result.rows;
};

const createVehicle = async (uid, data) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // IoT Device Assignment Logic (Mandatory)
    const rawDeviceId = data.deviceId ? String(data.deviceId).trim() : '';
    if (!rawDeviceId) {
      throw new Error('IoT Device ID is mandatory. Please assign a DravYantra device to this vehicle.');
    }
    
    const deviceRes = await client.query('SELECT * FROM devices WHERE device_id = $1', [rawDeviceId]);
    if (deviceRes.rows.length === 0) {
      throw new Error(`Device '${rawDeviceId}' not found in system. Please enter a valid DravYantra Device ID.`);
    }
    
    const device = deviceRes.rows[0];
    if (device.status !== 'Available') {
      throw new Error(`Device '${rawDeviceId}' is currently ${device.status} and cannot be assigned.`);
    }
    if (device.assigned_vehicle) {
      throw new Error(`Device '${rawDeviceId}' is already assigned to vehicle ${device.assigned_vehicle}.`);
    }
    
    const validDeviceId = rawDeviceId;

    const result = await client.query(
      `INSERT INTO vehicles (plate, uid, device_id, year, type, status, driver, loc, speed, fuel, mil, idle, fastag, health, odo, next_service, last_fill, lat, lng, route, alerts, service_history, rc_url, make, model, fuel_type, fuel_capacity) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) 
       RETURNING *`,
      [
        data.plate,
        uid,
        validDeviceId,
        data.year,
        data.type,
        data.status || 'Active',
        data.driver || null,
        data.loc || null,
        data.speed || 0,
        data.fuel || 100,
        data.mil,
        data.idle || 0,
        data.fastag || 0,
        data.health || 100,
        data.odo,
        data.next_service,
        data.last_fill || null,
        data.lat || null,
        data.lng || null,
        JSON.stringify(data.route || []),
        JSON.stringify(data.alerts || []),
        JSON.stringify(data.service_history || []),
        data.rc_url || null,
        data.make,
        data.model,
        data.fuel_type,
        data.fuel_capacity
      ]
    );
    
    // Update the device table to Assigned
    await client.query(
      `UPDATE devices SET status = 'Assigned', assigned_vehicle = $1, assigned_organization = $2, updated_at = CURRENT_TIMESTAMP WHERE device_id = $3`,
      [data.plate, uid, validDeviceId]
    );
    await client.query(
      `INSERT INTO device_audit_logs (device_id, fleet_owner_uid, action, remarks) VALUES ($1, $2, 'Device Assigned', $3)`,
      [validDeviceId, uid, `Assigned to vehicle ${data.plate}`]
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const updateVehicle = async (uid, plate, data) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if device assignment is changing
    const oldVehRes = await client.query('SELECT device_id FROM vehicles WHERE plate = $1 AND uid = $2', [plate, uid]);
    if (oldVehRes.rows.length === 0) {
      throw new Error('Vehicle not found or unauthorized');
    }
    const oldDeviceId = oldVehRes.rows[0].device_id;
    const newDeviceId = data.deviceId ? String(data.deviceId).trim() : null;

    if (!newDeviceId) {
      throw new Error('IoT Device ID is mandatory for this vehicle.');
    }

    if (newDeviceId && newDeviceId !== oldDeviceId) {
      // Validate new device
      const deviceRes = await client.query('SELECT * FROM devices WHERE device_id = $1', [newDeviceId]);
      if (deviceRes.rows.length === 0) throw new Error(`Device '${newDeviceId}' not found in system.`);
      const device = deviceRes.rows[0];
      if (device.status !== 'Available') throw new Error(`Device '${newDeviceId}' is currently ${device.status} and cannot be assigned.`);
      if (device.assigned_vehicle) throw new Error(`Device '${newDeviceId}' is already assigned to vehicle ${device.assigned_vehicle}.`);
      
      // Update new device
      await client.query(
        `UPDATE devices SET status = 'Assigned', assigned_vehicle = $1, assigned_organization = $2, updated_at = CURRENT_TIMESTAMP WHERE device_id = $3`,
        [plate, uid, newDeviceId]
      );
      await client.query(
        `INSERT INTO device_audit_logs (device_id, fleet_owner_uid, action, remarks) VALUES ($1, $2, 'Device Assigned', $3)`,
        [newDeviceId, uid, `Assigned to vehicle ${plate}`]
      );
    }
    
    if (oldDeviceId && oldDeviceId !== newDeviceId) {
      // Unassign old device
      await client.query(
        `UPDATE devices SET status = 'Available', assigned_vehicle = NULL, assigned_organization = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = $1`,
        [oldDeviceId]
      );
      await client.query(
        `INSERT INTO device_audit_logs (device_id, fleet_owner_uid, action, remarks) VALUES ($1, $2, 'Device Unassigned', $3)`,
        [oldDeviceId, uid, `Unassigned from vehicle ${plate}`]
      );
    }

    const result = await client.query(
      `UPDATE vehicles SET device_id=$1, year=$2, type=$3, status=$4, driver=$5, loc=$6, speed=$7, fuel=$8, mil=$9, idle=$10, fastag=$11, health=$12, odo=$13, next_service=$14, last_fill=$15, lat=$16, lng=$17, route=$18, alerts=$19, service_history=$20, rc_url=$21, make=$22, model=$23, fuel_type=$24, fuel_capacity=$25
       WHERE plate=$26 AND uid=$27
       RETURNING *`,
      [
        newDeviceId,
        data.year,
        data.type,
        data.status || 'Active',
        data.driver || null,
        data.loc || null,
        data.speed || 0,
        data.fuel || 100,
        data.mil,
        data.idle || 0,
        data.fastag || 0,
        data.health || 100,
        data.odo,
        data.next_service,
        data.last_fill || null,
        data.lat || null,
        data.lng || null,
        JSON.stringify(data.route || []),
        JSON.stringify(data.alerts || []),
        JSON.stringify(data.service_history || []),
        data.rc_url || null,
        data.make,
        data.model,
        data.fuel_type,
        data.fuel_capacity,
        plate,
        uid
      ]
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

const deleteVehicle = async (uid, plate) => {
  // Start a transaction to remove vehicle and clear references
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Unassign vehicle from trips, but skip manual overrides
    await client.query('UPDATE trips SET vehicle = $1 WHERE vehicle = $2 AND uid = $3', ['', plate, uid]);
    // Unassign vehicle from drivers
    await client.query('UPDATE drivers SET vehicle = $1 WHERE vehicle = $2 AND uid = $3', ['', plate, uid]);
    // Delete vehicle row
    const result = await client.query('DELETE FROM vehicles WHERE plate = $1 AND uid = $2 RETURNING *', [plate, uid]);
    
    if (result.rows.length > 0 && result.rows[0].device_id) {
      // Unassign device automatically when vehicle is deleted
      const oldDeviceId = result.rows[0].device_id;
      await client.query(
        `UPDATE devices SET status = 'Available', assigned_vehicle = NULL, assigned_organization = NULL, updated_at = CURRENT_TIMESTAMP WHERE device_id = $1`,
        [oldDeviceId]
      );
      await client.query(
        `INSERT INTO device_audit_logs (device_id, fleet_owner_uid, action, remarks) VALUES ($1, $2, 'Device Unassigned', $3)`,
        [oldDeviceId, uid, `Vehicle ${plate} was deleted. Device unassigned.`]
      );
    }
    
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllVehicles,
  getAvailableVehicles,
  createVehicle,
  updateVehicle
  , deleteVehicle
};
