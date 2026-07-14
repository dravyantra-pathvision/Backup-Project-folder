// modules/admin/analytics.service.js
const { pool } = require('../../config/dbconfig');

// Simple in-memory cache helper
const cache = {
  store: {},
  get(key) {
    const entry = this.store[key];
    if (entry && Date.now() - entry.timestamp < 30000) { // 30 seconds cache ttl
      return entry.data;
    }
    return null;
  },
  set(key, data) {
    this.store[key] = { data, timestamp: Date.now() };
  }
};

// Generates a cache key based on route path & query filters
const getCacheKey = (type, query) => {
  return `${type}_${JSON.stringify(query)}`;
};

// Dynamic SQL Filter builder
const buildFilter = (query, tableAlias = '') => {
  const conditions = [];
  const params = [];
  let idx = 1;
  const prefix = tableAlias ? `${tableAlias}.` : '';

  // 1. Organization ID — exact match on uid / assigned_organization
  if (query.organization_id) {
    if (tableAlias === 'devices') {
      conditions.push(`devices.assigned_organization = $${idx++}`);
      params.push(query.organization_id);
    } else if (['fo', 'u', 'v', 'd', 't', 'a'].includes(tableAlias)) {
      conditions.push(`${prefix}uid = $${idx++}`);
      params.push(query.organization_id);
    }
  }

  // 2. Vehicle Plate — partial ILIKE match, space-insensitive so 'ka33' matches 'KA 33'
  if (query.vehicle_plate) {
    const plate = `%${query.vehicle_plate.replace(/\s+/g, '')}%`;
    if (tableAlias === 'vehicles' || tableAlias === 'v') {
      conditions.push(`REPLACE(${prefix}plate, ' ', '') ILIKE $${idx++}`);
      params.push(plate);
    } else if (tableAlias === 'alerts' || tableAlias === 'a') {
      conditions.push(`REPLACE(${prefix}vehicle_plate, ' ', '') ILIKE $${idx++}`);
      params.push(plate);
    } else if (tableAlias === 'devices') {
      conditions.push(`REPLACE(devices.assigned_vehicle, ' ', '') ILIKE $${idx++}`);
      params.push(plate);
    } else if (tableAlias === 'd') {
      conditions.push(`REPLACE(d.vehicle, ' ', '') ILIKE $${idx++}`);
      params.push(plate);
    } else if (tableAlias === 't') {
      conditions.push(`REPLACE(t.vehicle, ' ', '') ILIKE $${idx++}`);
      params.push(plate);
    }
    // Ignore vehicle_plate for 'fo' (fleet_onboarding) and 'u' (users)
  }

  // 3. Driver — search by name OR driver-id using ILIKE
  //    trips.driver and vehicles.driver store the driver NAME (not id)
  //    drivers.id stores the driver code, drivers.name stores the name
  if (query.driver_id) {
    const drv = `%${query.driver_id.trim()}%`;
    if (tableAlias === 'drivers' || tableAlias === 'd') {
      // Match on name OR on the driver code id
      conditions.push(`(${prefix}name ILIKE $${idx} OR ${prefix}id ILIKE $${idx})`);
      params.push(drv);
      idx++;
    } else if (tableAlias === 'vehicles' || tableAlias === 'v') {
      // vehicles.driver stores name
      conditions.push(`${prefix}driver ILIKE $${idx++}`);
      params.push(drv);
    } else if (tableAlias === 'trips' || tableAlias === 't') {
      // trips.driver stores name
      conditions.push(`${prefix}driver ILIKE $${idx++}`);
      params.push(drv);
    } else if (tableAlias === 'alerts' || tableAlias === 'a') {
      conditions.push(`${prefix}driver ILIKE $${idx++}`);
      params.push(drv);
    }
    // Ignore driver_id for 'fo' (fleet_onboarding), 'u' (users), 'devices'
  }

  // 4. Date Range
  const dateCol = (tableAlias === 'alerts' || tableAlias === 'a') ? 'detected_at' : 'created_at';
  if (query.from_date) {
    conditions.push(`${prefix}${dateCol} >= $${idx++}`);
    params.push(query.from_date);
  }
  if (query.to_date) {
    conditions.push(`${prefix}${dateCol} <= $${idx++}`);
    params.push(query.to_date + ' 23:59:59');
  }

  return {
    where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    whereAnd: conditions.length ? 'AND ' + conditions.join(' AND ') : '',
    params
  };
};


const getOverview = async (query) => {
  const cacheKey = getCacheKey('overview', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fOrgs = buildFilter(query, 'fo');
  const fUsers = buildFilter(query, 'u');
  const fVeh = buildFilter(query, 'v');
  const fDrv = buildFilter(query, 'd');
  const fDev = buildFilter(query, 'devices');
  const fTrips = buildFilter(query, 't');
  const fAlerts = buildFilter(query, 'a');

  const [
    orgsCount,
    ownersCount,
    vehCount,
    drvCount,
    devCount,
    activeTrips,
    onlineVeh,
    offlineVeh,
    critAlerts,
    theftAlerts
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM fleet_onboarding fo ${fOrgs.where}`, fOrgs.params),
    pool.query(`SELECT COUNT(*) FROM users u ${fUsers.where ? fUsers.where + " AND u.role = 'fleet_owner'" : "WHERE u.role = 'fleet_owner'"}`, fUsers.params),
    pool.query(`SELECT COUNT(*) FROM vehicles v ${fVeh.where}`, fVeh.params),
    pool.query(`SELECT COUNT(*) FROM drivers d ${fDrv.where}`, fDrv.params),
    pool.query(`SELECT COUNT(*) FROM devices ${fDev.where}`, fDev.params),
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND t.trip_completed = false" : "WHERE t.trip_completed = false"}`, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM vehicles v ${fVeh.where ? fVeh.where + " AND v.status = 'active'" : "WHERE v.status = 'active'"}`, fVeh.params),
    pool.query(`SELECT COUNT(*) FROM vehicles v ${fVeh.where ? fVeh.where + " AND v.status != 'active'" : "WHERE v.status != 'active'"}`, fVeh.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND (a.severity = 'Critical' OR a.severity = 'critical') AND a.detected_at >= CURRENT_DATE" : "WHERE (a.severity = 'Critical' OR a.severity = 'critical') AND a.detected_at >= CURRENT_DATE"}`, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type IN ('Fuel Drop', 'Fuel Theft')" : "WHERE a.type IN ('Fuel Drop', 'Fuel Theft')"}`, fAlerts.params),
  ]);

  const result = {
    totalOrganizations: parseInt(orgsCount.rows[0].count, 10),
    totalFleetOwners: parseInt(ownersCount.rows[0].count, 10),
    totalVehicles: parseInt(vehCount.rows[0].count, 10),
    totalDrivers: parseInt(drvCount.rows[0].count, 10),
    totalDevices: parseInt(devCount.rows[0].count, 10),
    activeTripsToday: parseInt(activeTrips.rows[0].count, 10),
    onlineVehicles: parseInt(onlineVeh.rows[0].count, 10),
    offlineVehicles: parseInt(offlineVeh.rows[0].count, 10),
    criticalAlertsToday: parseInt(critAlerts.rows[0].count, 10),
    fuelTheftIncidents: parseInt(theftAlerts.rows[0].count, 10),
  };

  cache.set(cacheKey, result);
  return result;
};

const getFuelAnalytics = async (query) => {
  const cacheKey = getCacheKey('fuel', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fTrips = buildFilter(query, 't');
  const fAlerts = buildFilter(query, 'a');

  const [
    fuelTotals,
    thefts,
    theftVolume,
    topOrgs,
    leastOrgs,
    trend
  ] = await Promise.all([
    pool.query(`
      SELECT 
        COALESCE(SUM(t.fuel_used), 0.0) AS consumed,
        COALESCE(AVG(t.fuel_used), 0.0) AS avg_consumed,
        COALESCE(SUM(t.fuel_saved), 0.0) AS saved,
        COALESCE(SUM(t.total_idle_time * 1.7 / COALESCE(t.fuel_price_per_liter, 100.0)), 0.0) AS wasted_idle
      FROM trips t
      ${fTrips.where}
    `, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type IN ('Fuel Drop', 'Fuel Theft')" : "WHERE a.type IN ('Fuel Drop', 'Fuel Theft')"}`, fAlerts.params),
    pool.query(`SELECT COALESCE(SUM(t.theft_fuel_loss), 0.0) AS volume FROM trips t ${fTrips.where}`, fTrips.params),
    pool.query(`
      SELECT 
        fo.company_name, 
        ROUND((SUM(t.distance) / NULLIF(SUM(t.fuel_used), 0.0))::numeric, 2) AS avg_mileage
      FROM trips t
      JOIN fleet_onboarding fo ON t.uid = fo.uid
      ${fTrips.where ? fTrips.where + ' AND t.distance > 0' : 'WHERE t.distance > 0'}
      GROUP BY fo.company_name
      ORDER BY avg_mileage DESC
      LIMIT 5
    `, fTrips.params),
    pool.query(`
      SELECT 
        fo.company_name, 
        ROUND((SUM(t.distance) / NULLIF(SUM(t.fuel_used), 0.0))::numeric, 2) AS avg_mileage
      FROM trips t
      JOIN fleet_onboarding fo ON t.uid = fo.uid
      ${fTrips.where ? fTrips.where + ' AND t.distance > 0' : 'WHERE t.distance > 0'}
      GROUP BY fo.company_name
      ORDER BY avg_mileage ASC
      LIMIT 5
    `, fTrips.params),
    pool.query(`
      SELECT 
        DATE(t.created_at) AS date,
        ROUND(SUM(t.fuel_used)::numeric, 2) AS fuel_consumed
      FROM trips t
      ${fTrips.where}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `, fTrips.params)
  ]);

  const result = {
    totalFuelConsumed: parseFloat(fuelTotals.rows[0].consumed),
    avgFuelConsumption: parseFloat(fuelTotals.rows[0].avg_consumed),
    fuelSaved: parseFloat(fuelTotals.rows[0].saved),
    estimatedFuelWastedIdling: parseFloat(fuelTotals.rows[0].wasted_idle),
    fuelTheftCount: parseInt(thefts.rows[0].count, 10),
    fuelTheftVolume: parseFloat(theftVolume.rows[0].volume),
    topFuelEfficientOrgs: topOrgs.rows.map(r => ({ name: r.company_name, value: parseFloat(r.avg_mileage) })),
    leastEfficientOrgs: leastOrgs.rows.map(r => ({ name: r.company_name, value: parseFloat(r.avg_mileage) })),
    fuelConsumptionTrend: trend.rows.map(r => ({ date: r.date.toISOString().split('T')[0], value: parseFloat(r.fuel_consumed) }))
  };

  cache.set(cacheKey, result);
  return result;
};

const getVehicleAnalytics = async (query) => {
  const cacheKey = getCacheKey('vehicles', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fTrips = buildFilter(query, 't');
  const fVeh = buildFilter(query, 'v');

  const [
    distanceTotals,
    mostActive,
    leastActive,
    utilization,
    maintCount,
    downtime
  ] = await Promise.all([
    pool.query(`
      SELECT 
        COALESCE(SUM(t.distance), 0.0) AS total,
        COALESCE(AVG(t.distance), 0.0) AS avg_dist
      FROM trips t
      ${fTrips.where}
    `, fTrips.params),
    pool.query(`
      SELECT t.vehicle AS plate, SUM(t.distance) AS distance 
      FROM trips t 
      ${fTrips.where}
      GROUP BY t.vehicle 
      ORDER BY distance DESC 
      LIMIT 1
    `, fTrips.params),
    pool.query(`
      SELECT t.vehicle AS plate, SUM(t.distance) AS distance 
      FROM trips t 
      ${fTrips.where}
      GROUP BY t.vehicle 
      ORDER BY distance ASC 
      LIMIT 1
    `, fTrips.params),
    pool.query(`
      SELECT 
        (COUNT(DISTINCT t.vehicle)::double precision / NULLIF((SELECT COUNT(*) FROM vehicles v ${fVeh.where}), 0)) * 100 AS pct
      FROM trips t
      ${fTrips.where}
    `, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM vehicles v ${fVeh.where ? fVeh.where + " AND v.status ILIKE '%maintenance%'" : "WHERE v.status ILIKE '%maintenance%'"}`, fVeh.params),
    pool.query(`SELECT COALESCE(SUM(t.total_idle_time) / 3600.0, 0.0) AS hours FROM trips t ${fTrips.where}`, fTrips.params),
  ]);

  const result = {
    totalDistanceTravelled: parseFloat(distanceTotals.rows[0].total),
    avgDistancePerVehicle: parseFloat(distanceTotals.rows[0].avg_dist),
    mostActiveVehicle: mostActive.rows[0] ? { plate: mostActive.rows[0].plate, value: parseFloat(mostActive.rows[0].distance) } : null,
    leastActiveVehicle: leastActive.rows[0] ? { plate: leastActive.rows[0].plate, value: parseFloat(leastActive.rows[0].distance) } : null,
    vehicleUtilization: parseFloat(utilization.rows[0].pct || 0.0),
    vehiclesUnderMaintenance: parseInt(maintCount.rows[0].count, 10),
    vehicleDowntime: parseFloat(downtime.rows[0].hours),
  };

  cache.set(cacheKey, result);
  return result;
};

const getDriverAnalytics = async (query) => {
  const cacheKey = getCacheKey('drivers', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fDrv = buildFilter(query, 'd');
  const fTrips = buildFilter(query, 't');
  const fAlerts = buildFilter(query, 'a');

  const [
    activeDrivers,
    mostActive,
    avgHours,
    overspeed,
    harshBraking,
    rapidAcc,
    ranking,
    activeTripsCount,
    totalDriversCount
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM drivers d ${fDrv.where ? fDrv.where + " AND d.is_active = true" : "WHERE d.is_active = true"}`, fDrv.params),
    pool.query(`
      SELECT t.driver AS name, SUM(t.distance) AS distance 
      FROM trips t 
      ${fTrips.where}
      GROUP BY t.driver 
      ORDER BY distance DESC 
      LIMIT 1
    `, fTrips.params),
    pool.query(`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 3600.0), 0.0) AS avg_hours 
      FROM trips t 
      ${fTrips.where ? fTrips.where + " AND t.status = 'completed'" : "WHERE t.status = 'completed'"}
    `, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type = 'Overspeed'" : "WHERE a.type = 'Overspeed'"}`, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type = 'Harsh Braking'" : "WHERE a.type = 'Harsh Braking'"}`, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type = 'Rapid Acceleration'" : "WHERE a.type = 'Rapid Acceleration'"}`, fAlerts.params),
    pool.query(`
      SELECT d.name, COALESCE(d.score, 0) AS score, COALESCE(d.rating, 0.0) AS rating, COALESCE(fo.company_name, 'N/A') AS organization
      FROM drivers d
      LEFT JOIN fleet_onboarding fo ON d.uid = fo.uid
      ${fDrv.where}
      ORDER BY score DESC, rating DESC
      LIMIT 10
    `, fDrv.params),
    pool.query(`SELECT COUNT(DISTINCT t.driver) FROM trips t ${fTrips.where}`, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM drivers d ${fDrv.where}`, fDrv.params)
  ]);

  const activeCount = parseInt(activeTripsCount.rows[0].count, 10);
  const totalCount = parseInt(totalDriversCount.rows[0].count, 10);
  const driverUtilization = totalCount > 0 ? (activeCount / totalCount) * 100 : 0.0;

  const result = {
    totalActiveDrivers: parseInt(activeDrivers.rows[0].count, 10),
    mostActiveDriver: mostActive.rows[0] ? { name: mostActive.rows[0].name, value: parseFloat(mostActive.rows[0].distance) } : null,
    averageDailyDrivingHours: parseFloat(avgHours.rows[0].avg_hours),
    overspeedEvents: parseInt(overspeed.rows[0].count, 10),
    harshBrakingEvents: parseInt(harshBraking.rows[0].count, 10),
    rapidAccelerationEvents: parseInt(rapidAcc.rows[0].count, 10),
    driverSafetyRanking: ranking.rows.map(r => ({ name: r.name, score: r.score, rating: parseFloat(r.rating), organization: r.organization })),
    driverUtilization,
  };

  cache.set(cacheKey, result);
  return result;
};

const getTripAnalytics = async (query) => {
  const cacheKey = getCacheKey('trips', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fTrips = buildFilter(query, 't');

  const [
    todayCount,
    weekCount,
    monthCount,
    tripStats,
    completedCount,
    cancelledCount,
    trend
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND t.created_at >= CURRENT_DATE" : "WHERE t.created_at >= CURRENT_DATE"}`, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND t.created_at >= DATE_TRUNC('week', CURRENT_DATE)" : "WHERE t.created_at >= DATE_TRUNC('week', CURRENT_DATE)"}`, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE)" : "WHERE t.created_at >= DATE_TRUNC('month', CURRENT_DATE)"}`, fTrips.params),
    pool.query(`
      SELECT 
        COALESCE(AVG(t.distance), 0.0) AS avg_dist,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 60.0), 0.0) AS avg_dur,
        COALESCE(MAX(t.distance), 0.0) AS max_dist,
        COALESCE(MIN(t.distance), 0.0) AS min_dist
      FROM trips t
      ${fTrips.where}
    `, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND (t.status = 'completed' OR t.trip_completed = true)" : "WHERE (t.status = 'completed' OR t.trip_completed = true)"}`, fTrips.params),
    pool.query(`SELECT COUNT(*) FROM trips t ${fTrips.where ? fTrips.where + " AND t.status = 'cancelled'" : "WHERE t.status = 'cancelled'"}`, fTrips.params),
    pool.query(`
      SELECT 
        DATE(t.created_at) AS date,
        COUNT(*) AS trip_count
      FROM trips t
      ${fTrips.where}
      GROUP BY DATE(t.created_at)
      ORDER BY date ASC
    `, fTrips.params),
  ]);

  const result = {
    tripsToday: parseInt(todayCount.rows[0].count, 10),
    tripsThisWeek: parseInt(weekCount.rows[0].count, 10),
    tripsThisMonth: parseInt(monthCount.rows[0].count, 10),
    averageTripDistance: parseFloat(tripStats.rows[0].avg_dist),
    averageTripDuration: parseFloat(tripStats.rows[0].avg_dur),
    longestTrip: parseFloat(tripStats.rows[0].max_dist),
    shortestTrip: parseFloat(tripStats.rows[0].min_dist),
    completedTrips: parseInt(completedCount.rows[0].count, 10),
    cancelledTrips: parseInt(cancelledCount.rows[0].count, 10),
    tripsTrend: trend.rows.map(r => ({ date: r.date.toISOString().split('T')[0], value: parseInt(r.trip_count, 10) }))
  };

  cache.set(cacheKey, result);
  return result;
};

const getDeviceAnalytics = async (query) => {
  const cacheKey = getCacheKey('devices', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fDev = buildFilter(query, 'devices');
  const fAlerts = buildFilter(query, 'a');

  const [
    online,
    offline,
    failures,
    firmware,
    hardware,
    signal,
    gpsAvail
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM devices WHERE status IN ('Assigned', 'Active') ${fDev.whereAnd}`, fDev.params),
    pool.query(`SELECT COUNT(*) FROM devices WHERE status NOT IN ('Assigned', 'Active') ${fDev.whereAnd}`, fDev.params),
    pool.query(`SELECT COUNT(*) FROM alerts a ${fAlerts.where ? fAlerts.where + " AND a.type IN ('Heartbeat Failure', 'GPS Signal Lost')" : "WHERE a.type IN ('Heartbeat Failure', 'GPS Signal Lost')"}`, fAlerts.params),
    pool.query(`SELECT COALESCE(firmware_version, 'Unknown') AS version, COUNT(*) AS count FROM devices ${fDev.where} GROUP BY firmware_version`, fDev.params),
    pool.query(`SELECT COALESCE(hardware_version, 'Unknown') AS version, COUNT(*) AS count FROM devices ${fDev.where} GROUP BY hardware_version`, fDev.params),
    pool.query(`SELECT COALESCE(AVG(signal_strength), 0.0) AS strength FROM devices ${fDev.where}`, fDev.params),
    pool.query(`
      SELECT 
        (COUNT(*) FILTER (WHERE gps_status IN ('Active', 'Active/Fixed', 'Fixed'))::double precision / NULLIF(COUNT(*), 0)) * 100 AS pct
      FROM devices
      ${fDev.where}
    `, fDev.params),
  ]);

  const result = {
    onlineDevices: parseInt(online.rows[0].count, 10),
    offlineDevices: parseInt(offline.rows[0].count, 10),
    heartbeatFailures: parseInt(failures.rows[0].count, 10),
    firmwareDistribution: firmware.rows.map(r => ({ name: r.version, value: parseInt(r.count, 10) })),
    hardwareVersionDistribution: hardware.rows.map(r => ({ name: r.version, value: parseInt(r.count, 10) })),
    averageSignalStrength: parseFloat(signal.rows[0].strength),
    gpsAvailability: parseFloat(gpsAvail.rows[0].pct || 0.0),
  };

  cache.set(cacheKey, result);
  return result;
};

const getEnvironmentAnalytics = async (query) => {
  const cacheKey = getCacheKey('environment', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fTrips = buildFilter(query, 't');

  const [
    fuelTotals,
    carbonByOrg,
    monthlyCarbon,
  ] = await Promise.all([
    pool.query(`
      SELECT 
        COALESCE(SUM(t.fuel_used), 0.0) AS consumed,
        COALESCE(SUM(t.fuel_saved), 0.0) AS saved,
        COALESCE(SUM(t.total_idle_time * 1.7 / COALESCE(t.fuel_price_per_liter, 100.0)), 0.0) AS wasted_idle,
        COALESCE(SUM(t.total_idle_time) / 3600.0, 0.0) AS idle_hours
      FROM trips t
      ${fTrips.where}
    `, fTrips.params),
    pool.query(`
      SELECT 
        fo.company_name, 
        ROUND((SUM(t.fuel_saved) * 2.68)::numeric, 2) AS co2_saved 
      FROM trips t 
      JOIN fleet_onboarding fo ON t.uid = fo.uid 
      ${fTrips.where}
      GROUP BY fo.company_name 
      ORDER BY co2_saved DESC
      LIMIT 10
    `, fTrips.params),
    pool.query(`
      SELECT 
        TO_CHAR(t.created_at, 'YYYY-MM') AS month, 
        ROUND((SUM(t.fuel_saved) * 2.68)::numeric, 2) AS co2_saved 
      FROM trips t 
      ${fTrips.where}
      GROUP BY TO_CHAR(t.created_at, 'YYYY-MM') 
      ORDER BY month ASC
    `, fTrips.params)
  ]);

  const fuelSaved = parseFloat(fuelTotals.rows[0].saved);
  const carbonSavedKg = fuelSaved * 2.68;

  const result = {
    estimatedCo2Emissions: parseFloat((parseFloat(fuelTotals.rows[0].consumed) * 2.68).toFixed(2)),
    estimatedCo2Saved: parseFloat(carbonSavedKg.toFixed(2)),
    idleFuelWaste: parseFloat(fuelTotals.rows[0].wasted_idle),
    idleTimeReduction: parseFloat(fuelTotals.rows[0].idle_hours),
    carbonReductionByOrganization: carbonByOrg.rows.map(r => ({ name: r.company_name, value: parseFloat(r.co2_saved) })),
    monthlyCarbonSavings: monthlyCarbon.rows.map(r => ({ name: r.month, value: parseFloat(r.co2_saved) })),
    estimatedCarbonCredits: parseFloat((carbonSavedKg / 1000.0).toFixed(4)), // 1 Tonne = 1 Carbon Credit
  };

  cache.set(cacheKey, result);
  return result;
};

const getAlertAnalytics = async (query) => {
  const cacheKey = getCacheKey('alerts', query);
  const cachedData = cache.get(cacheKey);
  if (cachedData) return cachedData;

  const fAlerts = buildFilter(query, 'a');

  const [
    byType,
    byOrg,
    critical,
    resolved,
    pending,
    resolutionTime
  ] = await Promise.all([
    pool.query(`SELECT type, COUNT(*) AS count FROM alerts a ${fAlerts.where} GROUP BY type`, fAlerts.params),
    pool.query(`
      SELECT fo.company_name, COUNT(a.id) AS count 
      FROM alerts a 
      JOIN fleet_onboarding fo ON a.uid = fo.uid 
      ${fAlerts.where}
      GROUP BY fo.company_name
      ORDER BY count DESC
      LIMIT 10
    `, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a WHERE (severity = 'Critical' OR severity = 'critical') ${fAlerts.whereAnd}`, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a WHERE status = 'Resolved' ${fAlerts.whereAnd}`, fAlerts.params),
    pool.query(`SELECT COUNT(*) FROM alerts a WHERE status IN ('New', 'Acknowledged', 'In Progress') ${fAlerts.whereAnd}`, fAlerts.params),
    pool.query(`
      SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - detected_at)) / 60.0), 0.0) AS avg_res 
      FROM alerts a 
      WHERE resolved_at IS NOT NULL ${fAlerts.whereAnd}
    `, fAlerts.params)
  ]);

  const result = {
    alertsByType: byType.rows.map(r => ({ name: r.type, value: parseInt(r.count, 10) })),
    alertsByOrganization: byOrg.rows.map(r => ({ name: r.company_name, value: parseInt(r.count, 10) })),
    criticalAlerts: parseInt(critical.rows[0].count, 10),
    resolvedAlerts: parseInt(resolved.rows[0].count, 10),
    pendingAlerts: parseInt(pending.rows[0].count, 10),
    averageResolutionTime: parseFloat(resolutionTime.rows[0].avg_res),
  };

  cache.set(cacheKey, result);
  return result;
};

const exportAnalyticsData = async (query) => {
  const fOrgs = buildFilter(query, 'fo');
  // Dynamic compilation of organizations and their summary metrics
  const exportQuery = `
    SELECT 
      fo.company_name AS "Organization Name",
      u.email AS "Fleet Owner Email",
      (SELECT COUNT(*) FROM vehicles v WHERE v.uid = fo.uid) AS "Total Vehicles",
      (SELECT COUNT(*) FROM devices d WHERE d.assigned_organization = fo.uid) AS "Total Devices",
      (SELECT COUNT(*) FROM trips t WHERE t.uid = fo.uid AND t.trip_completed = false) AS "Active Trips",
      COALESCE((SELECT ROUND(SUM(distance)::numeric, 2) FROM trips t WHERE t.uid = fo.uid), 0.0) AS "Total Distance (km)",
      COALESCE((SELECT ROUND(SUM(fuel_used)::numeric, 2) FROM trips t WHERE t.uid = fo.uid), 0.0) AS "Fuel Used (liters)",
      COALESCE((SELECT ROUND(SUM(fuel_saved)::numeric, 2) FROM trips t WHERE t.uid = fo.uid), 0.0) AS "Fuel Saved (liters)",
      COALESCE((SELECT COUNT(*) FROM alerts a WHERE a.uid = fo.uid AND a.severity = 'Critical'), 0) AS "Critical Alerts",
      COALESCE((SELECT ROUND(AVG(score)::numeric, 1) FROM drivers dr WHERE dr.uid = fo.uid), 0.0) AS "Avg Driver Safety Score"
    FROM fleet_onboarding fo
    JOIN users u ON fo.uid = u.uid
    ${fOrgs.where}
    ORDER BY fo.company_name ASC
  `;
  const res = await pool.query(exportQuery, fOrgs.params);
  return res.rows;
};

module.exports = {
  getOverview,
  getFuelAnalytics,
  getVehicleAnalytics,
  getDriverAnalytics,
  getTripAnalytics,
  getDeviceAnalytics,
  getEnvironmentAnalytics,
  getAlertAnalytics,
  exportAnalyticsData
};
