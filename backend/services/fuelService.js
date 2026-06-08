// services/fuelService.js
// Extracted SQL operations for L215-241 of index.js
const { pool } = require('../config/dbconfig');

const getAllFuelLogs = async (uid) => {
  const result = await pool.query(
    'SELECT * FROM fuel_logs WHERE uid = $1',
    [uid]
  );
  return result.rows;
};

const createFuelLog = async (uid, data) => {
  const result = await pool.query(
    `INSERT INTO fuel_logs (id, uid, vehicle, driver, station, liters, rate, cost, odometer, date, is_suspect, suspect_reason) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
     ON CONFLICT (id) DO UPDATE SET 
       vehicle=EXCLUDED.vehicle, 
       driver=EXCLUDED.driver, 
       station=EXCLUDED.station, 
       liters=EXCLUDED.liters, 
       rate=EXCLUDED.rate, 
       cost=EXCLUDED.cost, 
       odometer=EXCLUDED.odometer, 
       date=EXCLUDED.date, 
       is_suspect=EXCLUDED.is_suspect, 
       suspect_reason=EXCLUDED.suspect_reason
     RETURNING *`,
    [
      data.id,
      uid,
      data.vehicle,
      data.driver,
      data.station,
      data.liters,
      data.rate,
      data.cost,
      data.odometer,
      data.date,
      data.is_suspect,
      data.suspect_reason
    ]
  );
  return result.rows[0];
};

module.exports = {
  getAllFuelLogs,
  createFuelLog
};
