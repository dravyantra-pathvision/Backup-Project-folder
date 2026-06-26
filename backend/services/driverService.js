// services/driverService.js
// Extracted SQL operations for L158-213 of index.js
const { pool } = require('../config/dbconfig');

const getAllDrivers = async (uid) => {
  const result = await pool.query(
    'SELECT * FROM drivers WHERE uid = $1',
    [uid]
  );
  return result.rows;
};

const getAvailableDrivers = async (uid) => {
  const result = await pool.query(
    `SELECT * FROM drivers d WHERE d.uid = $1
       AND (d.vehicle IS NULL OR d.vehicle = '' OR d.vehicle = 'None' OR d.vehicle = 'Unassigned')
       AND NOT EXISTS (
         SELECT 1 FROM trips t WHERE t.uid = $1 AND (t.driver = d.id OR t.driver = d.name) AND (t.trip_completed IS NOT TRUE)
       )`,
    [uid]
  );
  return result.rows;
};

const getAssignedDrivers = async (uid) => {
  const result = await pool.query(
    "SELECT * FROM drivers WHERE uid = $1 AND vehicle IS NOT NULL AND vehicle <> ''",
    [uid]
  );
  return result.rows;
};

const createDriver = async (uid, data) => {
  const result = await pool.query(
    `INSERT INTO drivers (id, uid, name, phone, age, exp, lic, lic_exp, blood, vehicle, status, score, mil, idle, trips, harsh, over_speed, deviation, fuel_eff, rating, home, on_leave, is_active, trip_history, image_url, aadhar_url, license_url) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27) 
     ON CONFLICT (id) DO UPDATE SET
       uid = $2, name = $3, phone = $4, age = $5, exp = $6, lic = $7, lic_exp = $8, blood = $9,
       vehicle = $10, status = $11, score = $12, mil = $13, idle = $14, trips = $15, harsh = $16,
       over_speed = $17, deviation = $18, fuel_eff = $19, rating = $20, home = $21, on_leave = $22,
       is_active = $23, trip_history = $24, image_url = $25, aadhar_url = $26, license_url = $27
     RETURNING *`,
    [
      data.id,
      uid,
      data.name,
      data.phone,
      data.age,
      data.exp,
      data.lic,
      data.lic_exp,
      data.blood,
      data.vehicle,
      data.status,
      data.score,
      data.mil,
      data.idle,
      data.trips,
      data.harsh,
      data.over_speed,
      data.deviation,
      data.fuel_eff,
      data.rating,
      data.home,
      data.on_leave,
      data.is_active,
      JSON.stringify(data.trip_history || []),
      data.image_url,
      data.aadhar_url || data.aadharUrl || '',
      data.license_url || data.licenseUrl || ''
    ]
  );
  return result.rows[0];
};

const updateDriver = async (uid, id, data) => {
  const result = await pool.query(
    `UPDATE drivers SET name=$1, phone=$2, age=$3, exp=$4, lic=$5, lic_exp=$6, blood=$7, vehicle=$8, status=$9, score=$10, mil=$11, idle=$12, trips=$13, harsh=$14, over_speed=$15, deviation=$16, fuel_eff=$17, rating=$18, home=$19, on_leave=$20, is_active=$21, trip_history=$22, image_url=$23, aadhar_url=$24, license_url=$25
     WHERE id=$26 AND uid=$27
     RETURNING *`,
    [
      data.name,
      data.phone,
      data.age,
      data.exp,
      data.lic,
      data.lic_exp,
      data.blood,
      data.vehicle,
      data.status,
      data.score,
      data.mil,
      data.idle,
      data.trips,
      data.harsh,
      data.over_speed,
      data.deviation,
      data.fuel_eff,
      data.rating,
      data.home,
      data.on_leave,
      data.is_active,
      JSON.stringify(data.trip_history),
      data.image_url,
      data.aadhar_url || data.aadharUrl || '',
      data.license_url || data.licenseUrl || '',
      id,
      uid
    ]
  );
  return result.rows[0] || null;
};

const deleteDriver = async (uid, id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Fetch driver name (may be used in trips/vehicles)
    const nameRes = await client.query('SELECT name FROM drivers WHERE id = $1 AND uid = $2', [id, uid]);
    const driverName = (nameRes.rows[0] || {}).name || '';
    // Clear driver references in trips where driver equals id or name, but skip manual overrides
    await client.query('UPDATE trips SET driver = $1 WHERE (driver = $2 OR driver = $3) AND uid = $4', ['', id, driverName, uid]);
    // Clear driver field in vehicles where driver equals name or id
    await client.query('UPDATE vehicles SET driver = $1 WHERE (driver = $2 OR driver = $3) AND uid = $4', ['', id, driverName, uid]);
    // Delete the driver
    const result = await client.query('DELETE FROM drivers WHERE id = $1 AND uid = $2 RETURNING *', [id, uid]);
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
  getAllDrivers,
  getAvailableDrivers,
  getAssignedDrivers,
  createDriver,
  updateDriver
  , deleteDriver
};
