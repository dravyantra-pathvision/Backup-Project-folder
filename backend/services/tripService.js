// services/tripService.js
// Extracted SQL operations for L243-430 of index.js
const { pool } = require('../config/dbconfig');
const IDLE_COST_PER_HOUR_RUPEES = Number(process.env.IDLE_COST_PER_HOUR_RUPEES || process.env.IDLE_RUPEES_PER_60MIN || 100);
const DEFAULT_FUEL_PRICE_RUPEES = Number(process.env.DEFAULT_FUEL_PRICE_RUPEES || process.env.FUEL_PRICE_RUPEES || 100);

const getAllTrips = async (uid) => {
  // Only return trips that are not marked completed so UI "trips" section hides finished trips
  const result = await pool.query(
    'SELECT * FROM trips WHERE uid = $1 AND (trip_completed IS NOT TRUE)',
    [uid]
  );
  return result.rows;
};

const createTrip = async (uid, data) => {
  // Prevent assigning a vehicle or driver that already has an active trip
  if (data.vehicle) {
    const vRes = await pool.query('SELECT 1 FROM trips WHERE uid = $1 AND vehicle = $2 AND (trip_completed IS NOT TRUE) LIMIT 1', [uid, data.vehicle]);
    if (vRes.rowCount > 0) {
      const err = new Error('Vehicle already assigned to an active trip');
      err.code = 'ASSIGNED_VEHICLE';
      throw err;
    }
  }
  if (data.driver) {
    const dRes = await pool.query('SELECT 1 FROM trips WHERE uid = $1 AND driver = $2 AND (trip_completed IS NOT TRUE) LIMIT 1', [uid, data.driver]);
    if (dRes.rowCount > 0) {
      const err = new Error('Driver already assigned to an active trip');
      err.code = 'ASSIGNED_DRIVER';
      throw err;
    }
  }
  // compute mileage and fuel savings
  const distance = Number(data.distance || 0);
  const fuelUsed = Number(data.fuelUsed || 0);
  const defaultMileage = Number(data.defaultMileage || data.default_mileage || 4.0);
  const currentMileage = fuelUsed > 0 ? distance / fuelUsed : 0.0;
  const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
  const fuelSaved = Math.max(0, expectedFuel - fuelUsed);
  const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);
  const fuelPrice = Number(data.fuelPrice || data.fuel_price || DEFAULT_FUEL_PRICE_RUPEES);
  const idleSeconds = Number(data.idleDuration || data.idle_duration || 0);
  const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
  const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
  const fuelWasted = fuelWastedMileage + idleLiters;
  const moneySaved = (fuelSaved * fuelPrice) - idleRupees;
  // money wasted = fuel wasted valued at fixed 100 rupees/liter + idle money (100 rupees per 60 minutes)
  const MONEY_WASTED_PER_LITER = 100;
  const moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;

  const result = await pool.query(
    `INSERT INTO trips (id, uid, vehicle, driver, from_location, to_location, load, client, status, trip_completed, eway_bill, date, progress, distance, fuel_used, score, delay_minutes, waypoints, toll_count, live_speed, power, idle_duration, default_mileage, current_mileage, fuel_saved, fuel_wasted, money_saved, money_wasted) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) 
     ON CONFLICT (id) DO UPDATE SET
       vehicle = EXCLUDED.vehicle,
       driver = EXCLUDED.driver,
       from_location = EXCLUDED.from_location,
       to_location = EXCLUDED.to_location,
       load = EXCLUDED.load,
       client = EXCLUDED.client,
       status = EXCLUDED.status,
       eway_bill = EXCLUDED.eway_bill,
       date = EXCLUDED.date,
       progress = EXCLUDED.progress,
       distance = EXCLUDED.distance,
       fuel_used = EXCLUDED.fuel_used,
       score = EXCLUDED.score,
       delay_minutes = EXCLUDED.delay_minutes,
       waypoints = EXCLUDED.waypoints,
       toll_count = EXCLUDED.toll_count,
       live_speed = EXCLUDED.live_speed,
       power = EXCLUDED.power,
       idle_duration = EXCLUDED.idle_duration,
       trip_completed = EXCLUDED.trip_completed,
       default_mileage = EXCLUDED.default_mileage,
       current_mileage = EXCLUDED.current_mileage,
       fuel_saved = EXCLUDED.fuel_saved,
      fuel_wasted = EXCLUDED.fuel_wasted,
      money_saved = EXCLUDED.money_saved,
      money_wasted = EXCLUDED.money_wasted
     RETURNING *`,
    [
      data.id,
      uid,
      data.vehicle,
      data.driver,
      data.from,
      data.to,
      data.load,
      data.client,
      data.status || 'not started',
      data.tripCompleted || false,
      data.ewayBill,
      data.date,
      data.progress || 0.0,
      distance,
      fuelUsed,
      data.score || 0.0,
      data.delayMinutes || 0,
      JSON.stringify(data.waypoints || []),
      data.tollCount || 0,
      data.liveSpeed || 0.0,
      data.power || false,
      data.idleDuration || 0,
      defaultMileage,
      currentMileage,
      fuelSaved,
      fuelWasted,
      moneySaved,
      moneyWasted
    ]
  );
  return result.rows[0];
};

const updateTrip = async (uid, id, data) => {
  // Read previous row to detect transition to completed
  const prevRes = await pool.query('SELECT vehicle, driver, trip_completed FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
  const prev = prevRes.rows[0] || {};
  // compute mileage and fuel savings
  const distance = Number(data.distance || 0);
  const fuelUsed = Number(data.fuelUsed || 0);
  const defaultMileage = Number(data.defaultMileage || data.default_mileage || 4.0);
  const currentMileage = fuelUsed > 0 ? distance / fuelUsed : 0.0;
  const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
  const fuelSaved = Math.max(0, expectedFuel - fuelUsed);
  const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);
  const fuelPrice = Number(data.fuelPrice || data.fuel_price || DEFAULT_FUEL_PRICE_RUPEES);
  const idleSeconds = Number(data.idleDuration || data.idle_duration || 0);
  const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
  const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
  const fuelWasted = fuelWastedMileage + idleLiters;
  const moneySaved = (fuelSaved * fuelPrice) - idleRupees;
  // money wasted = fuel wasted valued at fixed 100 rupees/liter + idle money (100 rupees per 60 minutes)
  const MONEY_WASTED_PER_LITER = 100;
  const moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;

  const result = await pool.query(
      `UPDATE trips SET
         vehicle = $1,
         driver = $2,
         from_location = $3,
         to_location = $4,
         load = $5,
         client = $6,
         status = $7,
         trip_completed = $8,
         eway_bill = $9,
         date = $10,
         progress = $11,
         distance = $12,
         fuel_used = $13,
         score = $14,
         delay_minutes = $15,
         waypoints = $16,
         toll_count = $17,
         live_speed = $18,
         power = $19,
         idle_duration = $20,
         default_mileage = $21,
         current_mileage = $22,
         fuel_saved = $23,
         fuel_wasted = $24,
        money_saved = $25,
        money_wasted = $26
             WHERE id = $27 AND uid = $28 RETURNING *`,
      [
        data.vehicle,
        data.driver,
        data.from,
        data.to,
        data.load,
        data.client,
        data.status || 'not started',
        data.tripCompleted || false,
        data.ewayBill,
        data.date,
        data.progress || 0.0,
        distance,
        fuelUsed,
        data.score || 0.0,
        data.delayMinutes || 0,
        JSON.stringify(data.waypoints || []),
        data.tollCount || 0,
        data.liveSpeed || 0.0,
        data.power || false,
        data.idleDuration || 0,
            defaultMileage,
            currentMileage,
            fuelSaved,
            fuelWasted,
            moneySaved,
            moneyWasted,
            id,
            uid
      ]
  );

  const updated = result.rows[0] || null;

  // If trip just transitioned to completed, unassign the vehicle and driver
  try {
    if (updated && updated.trip_completed === true && prev.trip_completed !== true) {
      if (prev.vehicle) {
        await pool.query('UPDATE vehicles SET driver = $1 WHERE plate = $2 AND uid = $3', ['', prev.vehicle, uid]);
      }
      if (prev.driver) {
        // drivers table stores driver id in `id` and name in `name`; try to unassign by name first, then by id
        await pool.query('UPDATE drivers SET vehicle = $1 WHERE name = $2 AND uid = $3', ['', prev.driver, uid]);
        await pool.query('UPDATE drivers SET vehicle = $1 WHERE id = $2 AND uid = $3', ['', prev.driver, uid]);
      }
    }
  } catch (e) {
    console.error('Error unassigning vehicle/driver after trip completion:', e);
  }

  return updated;
};

const deleteTrip = async (uid, id) => {
  // Read the row first so we can unassign vehicle/driver after deletion
  const prevRes = await pool.query('SELECT vehicle, driver FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
  const prev = prevRes.rows[0] || null;

  const result = await pool.query(
    'DELETE FROM trips WHERE id = $1 AND uid = $2 RETURNING *',
    [id, uid]
  );
  const deleted = result.rows[0] || null;

  try {
    if (deleted && prev) {
      if (prev.vehicle) {
        await pool.query('UPDATE vehicles SET driver = $1 WHERE plate = $2 AND uid = $3', ['', prev.vehicle, uid]);
      }
      if (prev.driver) {
        await pool.query('UPDATE drivers SET vehicle = $1 WHERE name = $2 AND uid = $3', ['', prev.driver, uid]);
        await pool.query('UPDATE drivers SET vehicle = $1 WHERE id = $2 AND uid = $3', ['', prev.driver, uid]);
      }
    }
  } catch (e) {
    console.error('Error unassigning vehicle/driver after trip deletion:', e);
  }

  return deleted;
};

module.exports = {
  getAllTrips,
  createTrip,
  updateTrip,
  deleteTrip
};

// Returns aggregated totals for trips in a date range (inclusive).
// fromDate/toDate should be strings in 'YYYY-MM-DD' format or null to include all.
const getSummary = async (uid, fromDate, toDate) => {
  let where = 'WHERE uid = $1';
  const params = [uid];
  if (fromDate) {
    params.push(fromDate);
    where += ` AND date >= $${params.length}`;
  }
  if (toDate) {
    params.push(toDate);
    where += ` AND date <= $${params.length}`;
  }

  const q = `SELECT COALESCE(SUM(fuel_used),0)::double precision AS total_fuel_used, COALESCE(SUM(fuel_wasted),0)::double precision AS total_fuel_wasted, COALESCE(SUM(fuel_saved),0)::double precision AS total_fuel_saved, COALESCE(SUM(money_wasted),0)::double precision AS total_money_wasted, COALESCE(SUM(money_saved),0)::double precision AS total_money_saved FROM trips ${where}`;
  const res = await pool.query(q, params);
  const row = res.rows[0] || { total_fuel_used: 0, total_money_wasted: 0, total_money_saved: 0 };
  return {
    totalFuelUsed: Number(row.total_fuel_used || 0),
    totalFuelWasted: Number(row.total_fuel_wasted || 0),
    totalFuelSaved: Number(row.total_fuel_saved || 0),
    totalMoneyWasted: Number(row.total_money_wasted || 0),
    totalMoneySaved: Number(row.total_money_saved || 0),
  };
};

module.exports.getSummary = getSummary;
