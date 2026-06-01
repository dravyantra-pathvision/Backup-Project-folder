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
  const existingRes = data.id
    ? await pool.query('SELECT * FROM trips WHERE id = $1 AND uid = $2', [data.id, uid])
    : { rows: [] };
  const existing = existingRes.rows[0] || null;
  if (existing && existing.manual_override === true) {
    console.log(`createTrip: skipping overwrite for manual_override trip ${data.id}`);
    return existing;
  }

  // Prevent assigning a vehicle or driver that already has an active trip
  if (data.vehicle) {
    // When creating/upserting, allow the same trip id to keep its vehicle.
    const vParams = [uid, data.vehicle];
    let vQuery = 'SELECT 1 FROM trips WHERE uid = $1 AND vehicle = $2 AND (trip_completed IS NOT TRUE)';
    if (data.id) {
      vQuery += ' AND id <> $3';
      vParams.push(data.id);
    }
    vQuery += ' LIMIT 1';
    const vRes = await pool.query(vQuery, vParams);
    if (vRes.rowCount > 0) {
      const err = new Error('Vehicle already assigned to an active trip');
      err.code = 'ASSIGNED_VEHICLE';
      throw err;
    }
  }
  if (data.driver) {
    // Allow same trip id to retain its driver during upsert
    const dParams = [uid, data.driver];
    let dQuery = 'SELECT 1 FROM trips WHERE uid = $1 AND driver = $2 AND (trip_completed IS NOT TRUE)';
    if (data.id) {
      dQuery += ' AND id <> $3';
      dParams.push(data.id);
    }
    dQuery += ' LIMIT 1';
    const dRes = await pool.query(dQuery, dParams);
    if (dRes.rowCount > 0) {
      const err = new Error('Driver already assigned to an active trip');
      err.code = 'ASSIGNED_DRIVER';
      throw err;
    }
  }
  // compute mileage and fuel savings only when both distance and fuelUsed are provided
  // Ensure numeric variables exist even if client omits them
  var distance = Number(data.distance || 0);
  var fuelUsed = Number(data.fuelUsed || 0);
  let defaultMileage = Number(data.defaultMileage || data.default_mileage || 4.0);
  let currentMileage = fuelUsed > 0 ? (distance / fuelUsed) : 0.0;
  let fuelSaved = 0.0;
  let fuelWasted = 0.0;
  let moneySaved = 0.0;
  let moneyWasted = 0.0;
  if (distance > 0 && fuelUsed > 0) {
    defaultMileage = Number(data.defaultMileage || data.default_mileage || 4.0);
    currentMileage = fuelUsed > 0 ? distance / fuelUsed : 0.0;
    const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
    const fuelSavedVal = Math.max(0, expectedFuel - fuelUsed);
    const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);
    const fuelPrice = Number(data.fuelPrice || data.fuel_price || DEFAULT_FUEL_PRICE_RUPEES);
    const idleSeconds = (typeof data.idleDuration === 'number') ? data.idleDuration : 0;
    const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
    const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
    fuelWasted = fuelWastedMileage + idleLiters;
    fuelSaved = fuelSavedVal;
    moneySaved = (fuelSavedVal * fuelPrice) - idleRupees;
    const MONEY_WASTED_PER_LITER = 100;
    moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;
  }

  // When performing an upsert, avoid overwriting existing boolean flags (like `power`)
  // with falsy defaults if the client omitted them. Pass NULL for omitted values
  // and use COALESCE(EXCLUDED.col, trips.col) in the DO UPDATE clause so the
  // existing DB value is preserved unless the client explicitly provides one.
  const result = await pool.query(
    `INSERT INTO trips (id, uid, vehicle, driver, from_location, to_location, load, client, status, trip_completed, eway_bill, date, progress, distance, fuel_used, score, delay_minutes, waypoints, toll_count, live_speed, power, idle_duration, default_mileage, current_mileage, fuel_saved, fuel_wasted, money_saved, money_wasted, live_idle_speed, live_idle_time, live_fuel_count) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31) 
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
       power = COALESCE(EXCLUDED.power, trips.power),
       idle_duration = COALESCE(EXCLUDED.idle_duration, trips.idle_duration),
       trip_completed = COALESCE(EXCLUDED.trip_completed, trips.trip_completed),
       default_mileage = COALESCE(EXCLUDED.default_mileage, trips.default_mileage),
       current_mileage = COALESCE(EXCLUDED.current_mileage, trips.current_mileage),
       fuel_saved = COALESCE(EXCLUDED.fuel_saved, trips.fuel_saved),
      fuel_wasted = COALESCE(EXCLUDED.fuel_wasted, trips.fuel_wasted),
      money_saved = COALESCE(EXCLUDED.money_saved, trips.money_saved),
      money_wasted = COALESCE(EXCLUDED.money_wasted, trips.money_wasted),
      live_idle_speed = COALESCE(EXCLUDED.live_idle_speed, trips.live_idle_speed),
      live_idle_time = COALESCE(EXCLUDED.live_idle_time, trips.live_idle_time),
      live_fuel_count = COALESCE(EXCLUDED.live_fuel_count, trips.live_fuel_count),
      updated_at = CURRENT_TIMESTAMP
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
      (typeof data.tripCompleted === 'boolean') ? data.tripCompleted : null,
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
      (typeof data.power === 'boolean') ? data.power : null,
      (typeof data.idleDuration === 'number') ? data.idleDuration : null,
      defaultMileage,
      currentMileage,
      fuelSaved,
      fuelWasted,
      moneySaved,
      moneyWasted,
      (typeof data.liveIdleSpeed === 'number') ? data.liveIdleSpeed : null,
      (typeof data.liveIdleTime === 'string' && data.liveIdleTime !== '00:00:00') ? data.liveIdleTime : null,
      (typeof data.liveFuelCount === 'number') ? data.liveFuelCount : (typeof data.live_fuel_count === 'number' ? data.live_fuel_count : null)
    ]
  );
  const created = result.rows[0];

  // Keep vehicle's speed in sync when a trip is created with live_speed
  try {
    if (created && created.vehicle) {
      const newSpeed = created.trip_completed === true ? 0 : Number(created.live_speed || created.liveSpeed || 0);
      await pool.query('UPDATE vehicles SET speed = $1 WHERE plate = $2 AND uid = $3', [newSpeed, created.vehicle, uid]);
    }
  } catch (e) {
    console.error('Error syncing vehicle speed after trip create:', e);
  }

  return created;
};

const updateTrip = async (uid, id, data) => {
  const currentRes = await pool.query('SELECT * FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
  const current = currentRes.rows[0] || null;
  if (current && current.manual_override === true) {
    console.log(`updateTrip: skipping overwrite for manual_override trip ${id}`);
    return current;
  }

  // Read previous row to detect transition to completed and preserve fields
  const prevRes = await pool.query('SELECT vehicle, driver, trip_completed, power, idle_duration, live_idle_speed, live_idle_time FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
  const prev = prevRes.rows[0] || {};
  console.log(`updateTrip: id=${id} uid=${uid} incoming liveSpeed=${data.liveSpeed} prev.live_speed=${prev.live_speed || prev.liveSpeed}`);
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

  // Preserve existing boolean fields (like power) when client omitted them
  const powerParam = (typeof data.power === 'boolean') ? data.power : prev.power;

  // If client provided a last-updated timestamp, compare it with DB value
  const clientUpdatedRaw = data._updatedAt || data.updatedAt || data._updated_at || null;
  if (clientUpdatedRaw) {
    const parsed = new Date(clientUpdatedRaw);
    if (!isNaN(parsed.getTime())) {
      const dbTimeRes = await pool.query('SELECT updated_at FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
      const dbRow = dbTimeRes.rows[0];
      if (dbRow && dbRow.updated_at) {
        const dbTs = new Date(dbRow.updated_at);
        if (dbTs.getTime() > parsed.getTime()) {
          const err = new Error('Stale update: database has a newer version');
          err.code = 'STALE_UPDATE';
          throw err;
        }
      }
    }
  }

  // Prepare params: use NULL for omitted fields so UPDATE can COALESCE and preserve DB values
  const vehicleParam = (typeof data.vehicle === 'string') ? data.vehicle : null;
  const driverParam = (typeof data.driver === 'string') ? data.driver : null;
  const fromParam = (typeof data.from === 'string') ? data.from : null;
  const toParam = (typeof data.to === 'string') ? data.to : null;
  const loadParam = (typeof data.load === 'string') ? data.load : null;
  const clientParam = (typeof data.client === 'string') ? data.client : null;
  const statusParam = (typeof data.status === 'string') ? data.status : null;
  const tripCompletedParam = (typeof data.tripCompleted === 'boolean') ? data.tripCompleted : null;
  const ewayParam = (typeof data.ewayBill === 'string') ? data.ewayBill : null;
  const dateParam = (typeof data.date === 'string') ? data.date : null;
  const progressParam = (typeof data.progress === 'number') ? data.progress : null;
  const distanceParam = (typeof data.distance === 'number') ? distance : null;
  const fuelUsedParam = (typeof data.fuelUsed === 'number') ? fuelUsed : null;
  const scoreParam = (typeof data.score === 'number') ? data.score : null;
  const delayParam = (typeof data.delayMinutes === 'number') ? data.delayMinutes : null;
  const waypointsParam = (data.waypoints !== undefined) ? JSON.stringify(data.waypoints || []) : null;
  const tollParam = (typeof data.tollCount === 'number') ? data.tollCount : null;
  const liveSpeedParam = (typeof data.liveSpeed === 'number') ? data.liveSpeed : null;
  const powerParamParam = (typeof data.power === 'boolean') ? data.power : null;
  const idleDurationParam = (typeof data.idleDuration === 'number') ? data.idleDuration : null;
  const liveIdleSpeedParam = (typeof data.liveIdleSpeed === 'number') ? data.liveIdleSpeed : null;
  const liveIdleTimeParam = (typeof data.liveIdleTime === 'string' && data.liveIdleTime !== '00:00:00') ? data.liveIdleTime : null;
  const liveFuelCountParam = (typeof data.liveFuelCount === 'number') ? data.liveFuelCount : null;

  const result = await pool.query(
      `UPDATE trips SET
         vehicle = COALESCE($1, vehicle),
         driver = COALESCE($2, driver),
         from_location = COALESCE($3, from_location),
         to_location = COALESCE($4, to_location),
         load = COALESCE($5, load),
         client = COALESCE($6, client),
         status = COALESCE($7, status),
         trip_completed = COALESCE($8, trip_completed),
         eway_bill = COALESCE($9, eway_bill),
         date = COALESCE($10, date),
         progress = COALESCE($11, progress),
         distance = COALESCE($12, distance),
         fuel_used = COALESCE($13, fuel_used),
         score = COALESCE($14, score),
         delay_minutes = COALESCE($15, delay_minutes),
         waypoints = COALESCE($16, waypoints),
         toll_count = COALESCE($17, toll_count),
         live_speed = COALESCE($18, live_speed),
         power = COALESCE($19, power),
         idle_duration = COALESCE($20, idle_duration),
         live_idle_speed = COALESCE($21, live_idle_speed),
         live_idle_time = COALESCE($22, live_idle_time),
         live_fuel_count = COALESCE($23, live_fuel_count),
         updated_at = CURRENT_TIMESTAMP,
         default_mileage = COALESCE($24, default_mileage),
         current_mileage = COALESCE($25, current_mileage),
         fuel_saved = COALESCE($26, fuel_saved),
         fuel_wasted = COALESCE($27, fuel_wasted),
         money_saved = COALESCE($28, money_saved),
         money_wasted = COALESCE($29, money_wasted)
       WHERE id = $30 AND uid = $31 RETURNING *`,
        [
        vehicleParam,
        driverParam,
        fromParam,
        toParam,
        loadParam,
        clientParam,
        statusParam,
        tripCompletedParam,
        ewayParam,
        dateParam,
        progressParam,
        distanceParam,
        fuelUsedParam,
        scoreParam,
        delayParam,
        waypointsParam,
        tollParam,
        liveSpeedParam,
        powerParamParam,
        idleDurationParam,
        liveIdleSpeedParam,
        liveIdleTimeParam,
        liveFuelCountParam,
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
  console.log('updateTrip: rowCount=', result.rowCount, 'updated_live_speed=', result.rows[0] && (result.rows[0].live_speed || result.rows[0].liveSpeed));

  const updated = result.rows[0] || null;

  // Keep vehicle's speed column in sync with trip.live_speed for running trips.
  try {
    if (updated && updated.vehicle) {
      // If trip marked completed, clear vehicle speed to 0; otherwise set to trip live_speed
      const newSpeed = updated.trip_completed === true ? 0 : Number(updated.live_speed || updated.liveSpeed || 0);
      await pool.query('UPDATE vehicles SET speed = $1 WHERE plate = $2 AND uid = $3', [newSpeed, updated.vehicle, uid]);
    }
  } catch (e) {
    console.error('Error syncing vehicle speed after trip update:', e);
  }
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

  const q = `SELECT COALESCE(SUM(fuel_used),0)::double precision AS total_fuel_used, COALESCE(SUM(fuel_wasted),0)::double precision AS total_fuel_wasted, COALESCE(SUM(fuel_saved),0)::double precision AS total_fuel_saved, COALESCE(SUM(money_wasted),0)::double precision AS total_money_wasted, COALESCE(SUM(money_saved),0)::double precision AS total_money_saved, COALESCE(SUM(idle_duration),0)::double precision AS total_idle_duration_seconds FROM trips ${where}`;
  const res = await pool.query(q, params);
  const row = res.rows[0] || { total_fuel_used: 0, total_money_wasted: 0, total_money_saved: 0, total_idle_duration_seconds: 0 };
  return {
    totalFuelUsed: Number(row.total_fuel_used || 0),
    totalFuelWasted: Number(row.total_fuel_wasted || 0),
    totalFuelSaved: Number(row.total_fuel_saved || 0),
    totalMoneyWasted: Number(row.total_money_wasted || 0),
    totalMoneySaved: Number(row.total_money_saved || 0),
    totalIdleSeconds: Number(row.total_idle_duration_seconds || 0),
  };
};

module.exports.getSummary = getSummary;
