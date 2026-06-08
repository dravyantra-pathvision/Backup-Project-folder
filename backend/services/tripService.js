// services/tripService.js
// Extracted SQL operations for L243-430 of index.js
const { pool } = require('../config/dbconfig');
const { readFleetSettings } = require('./fleetSettingsStore');
const IDLE_COST_PER_HOUR_RUPEES = Number(process.env.IDLE_COST_PER_HOUR_RUPEES || process.env.IDLE_RUPEES_PER_60MIN || 100);
const DEFAULT_FUEL_PRICE_RUPEES = Number(process.env.DEFAULT_FUEL_PRICE_RUPEES || process.env.FUEL_PRICE_RUPEES || 100);

const parseNumber = (value, fallback = 0.0) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseHhMmSsToSeconds = (hhmmss) => {
  if (!hhmmss || typeof hhmmss !== 'string') return 0;
  const [h, m, s] = hhmmss.split(':').map(part => Number(part));
  if ([h, m, s].some(value => Number.isNaN(value))) return 0;
  return (h * 3600) + (m * 60) + s;
};

const getMileageFromLiveSpeed = (liveSpeed) => {
  const speed = Number(liveSpeed);
  if (!Number.isFinite(speed)) return 0.0;
  if (speed >= 40 && speed < 60) return 4.38;
  if (speed < 70) return 3.5;
  if (speed < 80) return 3.15;
  if (speed < 90) return 2.98;
  if (speed < 100) return 2.8;
  if (speed < 110) return 2.63;
  if (speed < 120) return 2.45;
  return 2.28;
};

const calculateSpeedingFuelWasted = (distance, currentMileage) => {
  const tripDistance = Number(distance);
  const mileage = Number(currentMileage);
  if (!Number.isFinite(tripDistance) || tripDistance <= 0) return 0.0;
  if (!Number.isFinite(mileage) || mileage <= 0 || mileage >= 3.5) return 0.0;

  const actualFuelUsed = tripDistance / mileage;
  const expectedFuelUsed = tripDistance / 3.5;
  return Number(Math.max(actualFuelUsed - expectedFuelUsed, 0).toFixed(2));
};

const getFleetFuelTheftThreshold = () => {
  const settings = readFleetSettings();
  const configured = Number(settings && settings.fuelDropThreshold);
  return Number.isFinite(configured) && configured > 0 ? configured : 0.7;
};

const getEffectiveIdleSeconds = (status, data, current) => {
  const rowStatus = (status || '').toString().toLowerCase();
  const storedIdleSeconds = Number(data.idleDuration ?? data.idle_duration ?? current?.idle_duration ?? 0);
  if (rowStatus === 'idle') {
    const liveIdle = parseHhMmSsToSeconds(data.liveIdleTime || data.live_idle_time || current?.live_idle_time || '00:00:00');
    return Math.max(storedIdleSeconds, liveIdle);
  }
  return storedIdleSeconds;
};

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
  const distance = parseNumber(data.distance ?? data.distanceTraveled ?? data.distance_traveled ?? 0);
  const liveSpeed = parseNumber(data.liveSpeed ?? data.live_speed ?? 0);
  const fuelUsed = parseNumber(data.fuelUsed ?? data.fuel_used ?? 0);
  let defaultMileage = parseNumber(data.defaultMileage ?? data.default_mileage ?? 4.0, 4.0);
  // Allow client to explicitly provide currentMileage in camelCase or snake_case.
  let currentMileage = liveSpeed > 0
    ? getMileageFromLiveSpeed(liveSpeed)
    : ((data.currentMileage !== undefined || data.current_mileage !== undefined)
      ? parseNumber(data.currentMileage ?? data.current_mileage, 0.0)
      : (fuelUsed > 0 ? (distance / fuelUsed) : 0.0));
  let effectiveFuelUsed = (distance > 0 && currentMileage > 0)
    ? Number((distance / currentMileage).toFixed(2))
    : fuelUsed;
  let fuelSaved = 0.0;
  let fuelWasted = 0.0;
  let moneySaved = 0.0;
  let moneyWasted = 0.0;
  if (distance > 0 && effectiveFuelUsed > 0) {
    // Preserve client-supplied currentMileage when provided, otherwise derive from liveSpeed or distance/fuelUsed.
    defaultMileage = parseNumber(data.defaultMileage ?? data.default_mileage ?? 4.0, 4.0);
    const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
    const fuelSavedVal = Math.max(0, expectedFuel - effectiveFuelUsed);
    const fuelWastedMileage = Math.max(0, effectiveFuelUsed - expectedFuel);
    const fuelPrice = Number(data.fuelPrice || data.fuel_price || DEFAULT_FUEL_PRICE_RUPEES);
    const idleSeconds = getEffectiveIdleSeconds(data.status || 'not started', data, null);
    const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
    const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
    fuelWasted = fuelWastedMileage + idleLiters;
    fuelSaved = fuelSavedVal;
    moneySaved = (fuelSavedVal * fuelPrice) - idleRupees;
    const MONEY_WASTED_PER_LITER = 100;
    moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;
  }

  // Compute speeding fuel wasted (trip-level) according to spec:
  const speedingFuelWasted = calculateSpeedingFuelWasted(distance, currentMileage);

  // When performing an upsert, avoid overwriting existing boolean flags (like `power`)
  // with falsy defaults if the client omitted them. Pass NULL for omitted values
  // and use COALESCE(EXCLUDED.col, trips.col) in the DO UPDATE clause so the
  // existing DB value is preserved unless the client explicitly provides one.
  const result = await pool.query(
    `INSERT INTO trips (id, uid, vehicle, driver, from_location, to_location, load, client, status, trip_completed, eway_bill, date, progress, distance, fuel_used, score, delay_minutes, waypoints, toll_count, live_speed, power, idle_duration, default_mileage, current_mileage, fuel_saved, fuel_wasted, money_saved, money_wasted, live_idle_speed, live_idle_time, live_fuel_count, total_idle_time, idle_money_wasted, speeding_fuel_wasted) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34) 
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
      total_idle_time = COALESCE(EXCLUDED.total_idle_time, trips.total_idle_time),
      idle_money_wasted = COALESCE(EXCLUDED.idle_money_wasted, trips.idle_money_wasted),
      speeding_fuel_wasted = COALESCE(EXCLUDED.speeding_fuel_wasted, trips.speeding_fuel_wasted),
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
      (typeof data.liveFuelCount === 'number') ? data.liveFuelCount : (typeof data.live_fuel_count === 'number' ? data.live_fuel_count : null),
      Math.round(idleSeconds / 60),
      Number(idleRupees.toFixed(2)),
      speedingFuelWasted
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

  // Read previous row to detect transition to completed and preserve fields
  const prevRes = await pool.query('SELECT vehicle, driver, trip_completed, power, idle_duration, live_idle_speed, live_idle_time FROM trips WHERE id = $1 AND uid = $2', [id, uid]);
  const prev = prevRes.rows[0] || {};
  console.log(`updateTrip: id=${id} uid=${uid} incoming liveSpeed=${data.liveSpeed} prev.live_speed=${prev.live_speed || prev.liveSpeed}`);
  // compute mileage and fuel savings
  const distance = parseNumber(data.distance ?? data.distanceTraveled ?? data.distance_traveled ?? current?.distance ?? 0);
  const liveSpeed = parseNumber(data.liveSpeed ?? data.live_speed ?? current?.live_speed ?? 0);
  const fuelUsed = parseNumber(data.fuelUsed ?? data.fuel_used ?? current?.fuel_used ?? 0);
  const defaultMileage = parseNumber(data.defaultMileage ?? data.default_mileage ?? current?.default_mileage ?? 4.0, 4.0);
  const hasExplicitCurrentMileage = data.currentMileage !== undefined || data.current_mileage !== undefined;
  // Preserve an explicit client mileage update; otherwise derive from live speed when available.
  const currentMileage = hasExplicitCurrentMileage
    ? parseNumber(data.currentMileage ?? data.current_mileage, 0.0)
    : (liveSpeed > 0
      ? getMileageFromLiveSpeed(liveSpeed)
      : (current?.current_mileage ? Number(current?.current_mileage) : (fuelUsed > 0 ? distance / fuelUsed : 0.0)));
  const effectiveFuelUsed = (distance > 0 && currentMileage > 0)
    ? Number((distance / currentMileage).toFixed(2))
    : fuelUsed;
  console.log('updateTrip debug:', { id, dataCurrentMileage: data.currentMileage, data_current_mileage: data.current_mileage, liveSpeed, currentMileage, distance, fuelUsed, effectiveFuelUsed, defaultMileage });
  const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
  const fuelSaved = Math.max(0, expectedFuel - effectiveFuelUsed);
  const fuelWastedMileage = Math.max(0, effectiveFuelUsed - expectedFuel);
  const fuelPrice = Number(data.fuelPrice ?? data.fuel_price ?? current?.fuel_price ?? DEFAULT_FUEL_PRICE_RUPEES);
  const previousFuelCount = parseNumber(current?.live_fuel_count ?? current?.liveFuelCount ?? 0);
  const incomingFuelCountProvided = data.liveFuelCount !== undefined || data.live_fuel_count !== undefined;
  const incomingFuelCount = incomingFuelCountProvided
    ? parseNumber(data.liveFuelCount ?? data.live_fuel_count, previousFuelCount)
    : previousFuelCount;
  const theftThreshold = getFleetFuelTheftThreshold();
  const theftDrop = Math.max(previousFuelCount - incomingFuelCount, 0);
  const theftFuelLoss = incomingFuelCountProvided
    ? (theftDrop >= theftThreshold ? Number(theftDrop.toFixed(2)) : 0.0)
    : parseNumber(current?.theft_fuel_loss ?? current?.theftFuelLoss ?? 0);
  const theftMoneyLoss = Number((theftFuelLoss * 100).toFixed(2));
  const status = (typeof data.status === 'string' ? data.status : current?.status || 'not started');
  const idleSeconds = getEffectiveIdleSeconds(status, data, current);
  const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
  const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
  const fuelWasted = fuelWastedMileage + idleLiters;
  const moneySaved = (fuelSaved * fuelPrice) - idleRupees;
  // money wasted = fuel wasted valued at fixed 100 rupees/liter + idle money (100 rupees per 60 minutes)
  const MONEY_WASTED_PER_LITER = 100;
  const moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;

  // compute speeding fuel wasted for update path as well
  const speedingFuelWasted = calculateSpeedingFuelWasted(distance, currentMileage);

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
  const theftFuelLossParam = theftFuelLoss;
  const theftMoneyLossParam = theftMoneyLoss;
  const manualOverrideParam = hasExplicitCurrentMileage ? true : null;

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
        money_wasted = COALESCE($29, money_wasted),
           total_idle_time = COALESCE($30, total_idle_time),
           idle_money_wasted = COALESCE($31, idle_money_wasted),
           theft_fuel_loss = COALESCE($32, theft_fuel_loss),
           theft_money_loss = COALESCE($33, theft_money_loss),
           manual_override = COALESCE($34, manual_override),
           speeding_fuel_wasted = COALESCE($37, speeding_fuel_wasted)
             WHERE id = $35 AND uid = $36 RETURNING *`,
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
        Math.round(idleSeconds / 60),
        Number(idleRupees.toFixed(2)),
        theftFuelLossParam,
        theftMoneyLossParam,
        manualOverrideParam,
        id,
        uid,
        // param for speeding_fuel_wasted
        speedingFuelWasted
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

  const q = `SELECT COALESCE(SUM(fuel_used),0)::double precision AS total_fuel_used, COALESCE(SUM(fuel_wasted),0)::double precision AS total_fuel_wasted, COALESCE(SUM(fuel_saved),0)::double precision AS total_fuel_saved, COALESCE(SUM(money_wasted),0)::double precision AS total_money_wasted, COALESCE(SUM(money_saved),0)::double precision AS total_money_saved, COALESCE(SUM(total_idle_time),0)::double precision AS total_idle_minutes, COALESCE(SUM(idle_money_wasted),0)::double precision AS total_idle_rupees FROM trips ${where}`;
  const res = await pool.query(q, params);
  const row = res.rows[0] || { total_fuel_used: 0, total_money_wasted: 0, total_money_saved: 0, total_idle_minutes: 0 };
  const totalIdleMinutes = Number(row.total_idle_minutes || 0);
  return {
    totalFuelUsed: Number(row.total_fuel_used || 0),
    totalFuelWasted: Number(row.total_fuel_wasted || 0),
    totalFuelSaved: Number(row.total_fuel_saved || 0),
    totalMoneyWasted: Number(row.total_money_wasted || 0),
    totalMoneySaved: Number(row.total_money_saved || 0),
    totalIdleRupees: Number(row.total_idle_rupees || 0),
    totalIdleMinutes,
    totalIdleSeconds: totalIdleMinutes * 60,
  };
};

module.exports.getSummary = getSummary;
