// controllers/fleetStatsController.js
// Fleet Analytics API — all time-windowed, never lifetime totals on dashboard.

'use strict';
const { pool }           = require('../config/dbconfig');
const fleetStatsEngine   = require('../services/fleetStatsEngine');
const { handleError }    = require('../utils/responseHandler');

// GET /api/analytics/fleet?period=today|week|month|year
// GET /api/analytics/fleet?period=custom&from=2025-01-01&to=2025-01-31
const getFleetStats = async (req, res) => {
  const uid = req.user.uid;
  const { period = 'today', from, to } = req.query;
  try {
    const stats = await fleetStatsEngine.getFleetStats(uid, period, from, to);
    res.json(stats);
  } catch (err) {
    handleError(res, 'Error fetching fleet stats', err);
  }
};

// GET /api/analytics/fleet/vehicles
const getVehicleStatuses = async (req, res) => {
  const uid = req.user.uid;
  try {
    const result = await pool.query(
      `SELECT
         v.plate, v.model, v.make, v.type, v.driver,
         v.device_id, v.status, v.lat, v.lng, v.speed,
         v.fuel, v.is_active, v.vibration,
         t.id         AS trip_id,
         t.status     AS trip_status,
         t.trip_state,
         t.distance   AS trip_distance,
         t.fuel_used  AS trip_fuel,
         t.trip_score,
         t.power,
         t.total_idle_time AS trip_idle_sec,
         t.moving_time_seconds AS trip_moving_sec,
         d.connection_status AS device_status,
         d.signal_quality,
         d.gps_fix_status,
         d.last_packet_at
       FROM vehicles v
       LEFT JOIN trips t
         ON t.vehicle = v.plate AND t.uid = v.uid AND t.trip_completed IS NOT TRUE
       LEFT JOIN devices d ON d.device_id = v.device_id
       WHERE v.uid = $1
       ORDER BY v.plate`,
      [uid]
    );

    const rows = result.rows.map(r => {
      // Derive avg_speed on the fly: distance / moving_time (never stored)
      const movingSec  = Number(r.trip_moving_sec || 0);
      const distanceKm = Number(r.trip_distance   || 0);
      const avgSpeed   = movingSec > 0 ? Number((distanceKm / (movingSec / 3600)).toFixed(1)) : 0;

      // Derive fuel cost: fuel_used × fuel_price_snapshot (computed, not stored)
      // Note: fuel_price_snapshot is per-trip and returned via analytics, not here
      return {
        ...r,
        tripAvgSpeedKmh: avgSpeed,
      };
    });

    res.json(rows);
  } catch (err) {
    handleError(res, 'Error fetching vehicle statuses', err);
  }
};

// GET /api/analytics/fleet/devices
const getDeviceStatuses = async (req, res) => {
  const uid = req.user.uid;
  try {
    const result = await pool.query(
      `SELECT
         d.device_id, d.status, d.assigned_vehicle,
         d.connection_status, d.signal_quality, d.gps_fix_status,
         d.battery_voltage, d.battery_level,
         d.last_heartbeat, d.last_packet_at, d.heartbeat_delay_seconds,
         d.firmware_version, d.device_type
       FROM devices d
       WHERE d.assigned_organization = $1
       ORDER BY d.device_id`,
      [uid]
    );
    res.json(result.rows);
  } catch (err) {
    handleError(res, 'Error fetching device statuses', err);
  }
};

// GET /api/analytics/fuel/refills?plate=&from=&to=
const getFuelRefills = async (req, res) => {
  const uid = req.user.uid;
  const { plate, from, to } = req.query;
  try {
    const params = [uid];
    let query = 'SELECT * FROM fuel_refill_events WHERE uid = $1';
    if (plate) { params.push(plate); query += ` AND vehicle_plate = $${params.length}`; }
    if (from)  { params.push(from);  query += ` AND detected_at >= $${params.length}`; }
    if (to)    { params.push(to);    query += ` AND detected_at <= $${params.length}`; }
    query += ' ORDER BY detected_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    handleError(res, 'Error fetching fuel refills', err);
  }
};

// GET /api/analytics/fuel/thefts?plate=&from=&to=
const getFuelThefts = async (req, res) => {
  const uid = req.user.uid;
  const { plate, from, to } = req.query;
  try {
    const params = [uid];
    let query = 'SELECT * FROM fuel_theft_events WHERE uid = $1';
    if (plate) { params.push(plate); query += ` AND vehicle_plate = $${params.length}`; }
    if (from)  { params.push(from);  query += ` AND detected_at >= $${params.length}`; }
    if (to)    { params.push(to);    query += ` AND detected_at <= $${params.length}`; }
    query += ' ORDER BY detected_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    handleError(res, 'Error fetching fuel thefts', err);
  }
};

// GET /api/analytics/telemetry?plate=&tripId=&from=&to=
const getTelemetryHistory = async (req, res) => {
  const uid = req.user.uid;
  const { plate, tripId, from, to, limit = 1000 } = req.query;
  try {
    const params = [uid];
    let query = 'SELECT * FROM telemetry_history WHERE uid = $1';
    if (plate)  { params.push(plate);  query += ` AND vehicle_plate = $${params.length}`; }
    if (tripId) { params.push(tripId); query += ` AND trip_id = $${params.length}`; }
    if (from)   { params.push(from);   query += ` AND received_at >= $${params.length}`; }
    if (to)     { params.push(to);     query += ` AND received_at <= $${params.length}`; }
    params.push(Math.min(Number(limit), 5000));
    query += ` ORDER BY received_at DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    handleError(res, 'Error fetching telemetry history', err);
  }
};

module.exports = {
  getFleetStats,
  getVehicleStatuses,
  getDeviceStatuses,
  getFuelRefills,
  getFuelThefts,
  getTelemetryHistory,
};
