// modules/admin/live.service.js
const { pool } = require('../../config/dbconfig');

const getLiveDashboard = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM vehicles) AS "totalVehicles",
      (SELECT COUNT(*) FROM vehicles WHERE status IN ('Moving', 'Idle', 'Running')) AS "onlineVehicles",
      (SELECT COUNT(*) FROM vehicles WHERE status IN ('Offline', 'Parked')) AS "offlineVehicles",
      (SELECT COUNT(*) FROM vehicles WHERE status = 'Moving') AS "vehiclesMoving",
      (SELECT COUNT(*) FROM vehicles WHERE status = 'Idle') AS "vehiclesIdle",
      (SELECT COUNT(*) FROM vehicles WHERE status = 'Parked') AS "vehiclesParked",
      (SELECT COUNT(*) FROM trips t WHERE t.trip_completed = false) AS "tripsRunning",
      (SELECT COUNT(*) FROM alerts a WHERE a.severity = 'critical' AND a.status = 'pending') AS "criticalAlerts",
      (SELECT COUNT(*) FROM alerts a WHERE (a.category = 'fuel' OR a.type = 'Fuel Theft') AND a.status = 'pending') AS "fuelTheftAlerts",
      (SELECT COUNT(*) FROM alerts a WHERE a.type = 'Overspeed' AND a.status = 'pending') AS "overspeedAlerts",
      (SELECT COUNT(*) FROM devices d WHERE d.status = 'Offline') AS "devicesOffline",
      (SELECT COUNT(DISTINCT fo.uid) FROM fleet_onboarding fo JOIN vehicles v ON fo.uid = v.uid WHERE v.status IN ('Moving', 'Idle')) AS "organizationsOnline"
  `;
  const res = await pool.query(query);
  return res.rows[0];
};

const getLiveVehicles = async ({ organization, fleetOwner, fleetUid, status, alertFilter, search }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (organization) {
    conditions.push(`fo.company_name ILIKE $${idx++}`);
    params.push(`%${organization}%`);
  }
  if (fleetUid) {
    // Filter by exact fleet owner UID (from the dropdown)
    conditions.push(`v.uid = $${idx++}`);
    params.push(fleetUid);
  } else if (fleetOwner) {
    conditions.push(`u.full_name ILIKE $${idx++}`);
    params.push(`%${fleetOwner}%`);
  }
  if (status) {
    conditions.push(`v.status ILIKE $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(v.plate ILIKE $${idx} OR d.name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  // Handle alert filters
  if (alertFilter === 'critical') {
    conditions.push(`EXISTS (SELECT 1 FROM alerts a WHERE a.vehicle_plate = v.plate AND a.severity = 'critical' AND a.status = 'pending')`);
  } else if (alertFilter === 'fuel_theft') {
    conditions.push(`EXISTS (SELECT 1 FROM alerts a WHERE a.vehicle_plate = v.plate AND (a.category = 'fuel' OR a.type = 'Fuel Theft') AND a.status = 'pending')`);
  } else if (alertFilter === 'overspeed') {
    conditions.push(`EXISTS (SELECT 1 FROM alerts a WHERE a.vehicle_plate = v.plate AND a.type = 'Overspeed' AND a.status = 'pending')`);
  }

  // Filter to approved orgs only — approval status is in fleet_onboarding.status
  conditions.push(`fo.status = 'Approved'`);

  const where = `WHERE ${conditions.join(' AND ')}`;

  const query = `
    SELECT 
      v.plate, v.lat, v.lng, v.speed, v.status, v.fuel, v.last_fill, v.loc as address,
      d.name AS driver_name,
      fo.company_name AS organization_name,
      u.full_name AS fleet_owner_name,
      t.id AS trip_id, t.status AS trip_status,
      dev.status AS device_status, dev.last_heartbeat, dev.signal_strength, dev.battery_level,
      EXISTS (SELECT 1 FROM alerts a WHERE a.vehicle_plate = v.plate AND a.severity = 'critical' AND a.status = 'pending') AS has_critical_alert
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver = d.id
    LEFT JOIN fleet_onboarding fo ON v.uid = fo.uid
    LEFT JOIN users u ON v.uid = u.uid
    LEFT JOIN trips t ON v.plate = t.vehicle AND t.trip_completed = false
    LEFT JOIN devices dev ON v.device_id = dev.device_id
    ${where}
    ORDER BY v.status, v.plate
  `;
  
  const res = await pool.query(query, params);
  return res.rows;
};

const getLiveVehicleDetail = async (id) => {
  const query = `
    SELECT 
      v.*,
      d.name AS driver_name, d.phone AS driver_phone,
      fo.company_name AS organization_name, fo.contact_number AS organization_phone,
      u.full_name AS fleet_owner_name,
      t.id AS trip_id, t.status AS trip_status, t.from_location, t.to_location, t.waypoints,
      dev.status AS device_status, dev.last_heartbeat, dev.signal_strength, dev.battery_level, dev.gps_status
    FROM vehicles v
    LEFT JOIN drivers d ON v.driver = d.id
    LEFT JOIN fleet_onboarding fo ON v.uid = fo.uid
    LEFT JOIN users u ON v.uid = u.uid
    LEFT JOIN trips t ON v.plate = t.vehicle AND t.trip_completed = false
    LEFT JOIN devices dev ON v.device_id = dev.device_id
    WHERE v.plate = $1
  `;
  const res = await pool.query(query, [id]);
  return res.rows[0];
};

const getLiveAlerts = async () => {
  // Fetch the latest 50 pending alerts for the live feed
  const query = `
    SELECT 
      a.id, a.vehicle_plate, a.type, a.message, a.severity, a.status, a.detected_at,
      fo.company_name AS organization_name
    FROM alerts a
    LEFT JOIN users u ON a.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
    WHERE a.status = 'pending'
    ORDER BY a.detected_at DESC
    LIMIT 50
  `;
  const res = await pool.query(query);
  return res.rows;
};

const getLiveStatistics = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM alerts WHERE detected_at >= CURRENT_DATE) AS "alertsToday",
      (SELECT COUNT(*) FROM trips WHERE trip_completed = true AND updated_at >= CURRENT_DATE) AS "tripsCompletedToday",
      (SELECT SUM(fuel_used) FROM trips WHERE updated_at >= CURRENT_DATE) AS "fuelConsumedToday",
      (SELECT SUM(idle_duration) FROM trips WHERE updated_at >= CURRENT_DATE) AS "totalIdleMinutesToday"
  `;
  const res = await pool.query(query);
  return res.rows[0];
};

const getLiveFleetList = async () => {
  // Returns all approved fleet owners — no vehicle join required to show them in the dropdown
  const query = `
    SELECT
      fo.uid,
      fo.company_name,
      u.full_name AS owner_name,
      COUNT(v.plate) AS vehicle_count
    FROM fleet_onboarding fo
    JOIN users u ON fo.uid = u.uid
    LEFT JOIN vehicles v ON fo.uid = v.uid
    WHERE fo.status = 'Approved'
    GROUP BY fo.uid, fo.company_name, u.full_name
    ORDER BY fo.company_name ASC
  `;
  const res = await pool.query(query);
  return res.rows;
};

module.exports = {
  getLiveDashboard,
  getLiveVehicles,
  getLiveVehicleDetail,
  getLiveAlerts,
  getLiveStatistics,
  getLiveFleetList,
};
