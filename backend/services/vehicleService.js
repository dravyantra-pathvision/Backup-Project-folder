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
    `SELECT * FROM vehicles v WHERE v.uid = $1 AND NOT EXISTS (
       SELECT 1 FROM trips t WHERE t.uid = $1 AND t.vehicle = v.plate AND (t.trip_completed IS NOT TRUE)
     )`,
    [uid]
  );
  return result.rows;
};

const createVehicle = async (uid, data) => {
  const result = await pool.query(
    `INSERT INTO vehicles (plate, uid, model, year, type, status, driver, loc, speed, fuel, mil, idle, fastag, health, odo, next_service, insurance, permit, puc, last_fill, lat, lng, route, alerts, service_history, image_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) 
     ON CONFLICT (plate) DO UPDATE SET
       uid = $2, model = $3, year = $4, type = $5, status = $6, driver = $7, loc = $8, speed = $9,
       fuel = $10, mil = $11, idle = $12, fastag = $13, health = $14, odo = $15, next_service = $16,
       insurance = $17, permit = $18, puc = $19, last_fill = $20, lat = $21, lng = $22,
       route = $23, alerts = $24, service_history = $25, image_url = $26
     RETURNING *`,
    [
      data.plate,
      uid,
      data.model,
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
      data.image_url
    ]
  );
  return result.rows[0];
};

const updateVehicle = async (uid, plate, data) => {
  const result = await pool.query(
    `UPDATE vehicles SET model=$1, year=$2, type=$3, status=$4, driver=$5, loc=$6, speed=$7, fuel=$8, mil=$9, idle=$10, fastag=$11, health=$12, odo=$13, next_service=$14, insurance=$15, permit=$16, puc=$17, last_fill=$18, lat=$19, lng=$20, route=$21, alerts=$22, service_history=$23, image_url=$24
     WHERE plate=$25 AND uid=$26
     RETURNING *`,
    [
      data.model,
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
      JSON.stringify(data.route),
      JSON.stringify(data.alerts),
      JSON.stringify(data.service_history),
      data.image_url,
      plate,
      uid
    ]
  );
  return result.rows[0] || null;
};

const deleteVehicle = async (uid, plate) => {
  // Start a transaction to remove vehicle and clear references
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Unassign vehicle from trips
    await client.query('UPDATE trips SET vehicle = $1 WHERE vehicle = $2 AND uid = $3', ['', plate, uid]);
    // Unassign vehicle from drivers
    await client.query('UPDATE drivers SET vehicle = $1 WHERE vehicle = $2 AND uid = $3', ['', plate, uid]);
    // Delete vehicle row
    const result = await client.query('DELETE FROM vehicles WHERE plate = $1 AND uid = $2 RETURNING *', [plate, uid]);
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
