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
       AND (v.driver IS NULL OR v.driver = '' OR v.driver = 'None' OR v.driver = 'Unassigned')
       AND NOT EXISTS (
         SELECT 1 FROM trips t WHERE t.uid = $1 AND t.vehicle = v.plate AND (t.trip_completed IS NOT TRUE)
       )`,
    [uid]
  );
  return result.rows;
};

const createVehicle = async (uid, data) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // IoT Device Assignment Logic
    let validDeviceId = null;
    if (data.deviceId && data.deviceId.trim() !== '') {
      const deviceId = data.deviceId.trim();
      
      const deviceRes = await client.query('SELECT * FROM devices WHERE device_id = $1', [deviceId]);
      if (deviceRes.rows.length === 0) {
        throw new Error('Device not found. Please check the Device ID.');
      }
      
      const device = deviceRes.rows[0];
      
      if (device.status !== 'Available') {
        throw new Error(`Device is currently ${device.status} and cannot be assigned.`);
      }
      if (device.assigned_vehicle) {
        throw new Error(`Device is already assigned to vehicle ${device.assigned_vehicle}.`);
      }
      
      validDeviceId = deviceId;
    }

    const result = await client.query(
      `INSERT INTO vehicles (plate, uid, device_id, year, type, status, driver, loc, speed, fuel, mil, idle, fastag, health, odo, next_service, insurance, permit, puc, last_fill, lat, lng, route, alerts, service_history, rc_url, insurance_url, puc_url, make, model, fuel_type, fuel_capacity) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32) 
       RETURNING *`,
      [
        data.plate,
        uid,
        validDeviceId,
        data.year,
        data.type,
        data.status,
        data.driver,
        data.loc,
        data.speed,
        data.fuel,
        data.mil,
        data.idle,
        data.fastag,
        data.health,
        data.odo,
        data.next_service,
        data.insurance,
        data.permit,
        data.puc,
        data.last_fill,
        data.lat,
        data.lng,
        JSON.stringify(data.route || []),
        JSON.stringify(data.alerts || []),
        JSON.stringify(data.service_history || []),
        data.rc_url,
        data.insurance_url,
        data.puc_url,
        data.make,
        data.model,
        data.fuel_type,
        data.fuel_capacity
      ]
    );
    
    // Update the device table if valid
    if (validDeviceId) {
      await client.query(
        `UPDATE devices SET status = 'Assigned', assigned_vehicle = $1, assigned_organization = $2, updated_at = CURRENT_TIMESTAMP WHERE device_id = $3`,
        [data.plate, uid, validDeviceId]
      );
      await client.query(
        `INSERT INTO device_audit_logs (device_id, fleet_owner_uid, action, remarks) VALUES ($1, $2, 'Device Assigned', $3)`,
        [validDeviceId, uid, `Assigned to vehicle ${data.plate}`]
      );
    }
    
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
    let newDeviceId = data.deviceId && data.deviceId.trim() !== '' ? data.deviceId.trim() : null;

    if (newDeviceId && newDeviceId !== oldDeviceId) {
      // Validate new device
      const deviceRes = await client.query('SELECT * FROM devices WHERE device_id = $1', [newDeviceId]);
      if (deviceRes.rows.length === 0) throw new Error('Device not found. Please check the Device ID.');
      const device = deviceRes.rows[0];
      if (device.status !== 'Available') throw new Error(`Device is currently ${device.status} and cannot be assigned.`);
      if (device.assigned_vehicle) throw new Error(`Device is already assigned to vehicle ${device.assigned_vehicle}.`);
      
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
      `UPDATE vehicles SET device_id=$1, year=$2, type=$3, status=$4, driver=$5, loc=$6, speed=$7, fuel=$8, mil=$9, idle=$10, fastag=$11, health=$12, odo=$13, next_service=$14, insurance=$15, permit=$16, puc=$17, last_fill=$18, lat=$19, lng=$20, route=$21, alerts=$22, service_history=$23, rc_url=$24, insurance_url=$25, puc_url=$26, make=$27, model=$28, fuel_type=$29, fuel_capacity=$30
       WHERE plate=$31 AND uid=$32
       RETURNING *`,
      [
        newDeviceId,
        data.year,
        data.type,
        data.status,
        data.driver,
        data.loc,
        data.speed,
        data.fuel,
        data.mil,
        data.idle,
        data.fastag,
        data.health,
        data.odo,
        data.next_service,
        data.insurance,
        data.permit,
        data.puc,
        data.last_fill,
        data.lat,
        data.lng,
        JSON.stringify(data.route || []),
        JSON.stringify(data.alerts || []),
        JSON.stringify(data.service_history || []),
        data.rc_url,
        data.insurance_url,
        data.puc_url,
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
