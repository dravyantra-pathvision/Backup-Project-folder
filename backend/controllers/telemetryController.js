// controllers/telemetryController.js
const { pool } = require('../config/dbconfig');
const { getDistanceFromLatLonInKm } = require('../utils/helpers');
const { handleError } = require('../utils/responseHandler');

const ingestTelemetry = async (req, res) => {
  const { deviceId, lat, lng, speed, power, fuel, vibration, timestamp } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'deviceId is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Find the vehicle
    const vehicleRes = await client.query('SELECT plate, uid, lat, lng, fuel FROM vehicles WHERE device_id = $1', [deviceId]);
    if (vehicleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Device not found' });
    }
    const vehicle = vehicleRes.rows[0];
    const plate = vehicle.plate;
    const uid = vehicle.uid;
    const oldLat = vehicle.lat;
    const oldLng = vehicle.lng;
    const oldFuel = vehicle.fuel;

    // 2. Update Vehicle telemetry
    // We add the new point to the route array.
    await client.query(
      `UPDATE vehicles 
       SET lat = $1, lng = $2, speed = $3, fuel = $4, is_active = $5,
           route = CASE WHEN $3 > 0 THEN route || $6::jsonb ELSE route END,
           loc = CASE WHEN loc IS NULL OR loc = '' THEN $7 ELSE loc END,
           vibration = $9
       WHERE device_id = $8`,
      [lat, lng, speed, fuel, power, JSON.stringify([[lat, lng]]), `Lat: ${lat}, Lng: ${lng}`, deviceId, vibration || 0.0]
    );

    // 3. Check for an active trip
    const tripRes = await client.query(
      `SELECT id, distance, fuel_used, total_idle_time, live_fuel_count, updated_at 
       FROM trips 
       WHERE vehicle = $1 AND uid = $2 AND trip_completed IS NOT TRUE 
       LIMIT 1`,
      [plate, uid]
    );

    if (tripRes.rows.length > 0) {
      const trip = tripRes.rows[0];
      
      let deltaDistance = 0;
      if (oldLat && oldLng && lat && lng && speed > 0) {
        deltaDistance = getDistanceFromLatLonInKm(oldLat, oldLng, lat, lng);
      }
      
      // Calculate idle delta (in seconds)
      let idleDeltaSeconds = 0;
      if (power === true && speed === 0) {
        const lastUpdate = new Date(trip.updated_at).getTime();
        const now = Date.now();
        // Fallback max 5 minutes to prevent huge idle jumps if ping was missed
        idleDeltaSeconds = Math.min((now - lastUpdate) / 1000, 300);
      }

      // Calculate fuel delta with basic smoothing to prevent sloshing errors
      let fuelDelta = 0;
      if (oldFuel !== null && fuel !== null && oldFuel > fuel) {
        const drop = oldFuel - fuel;
        // Only count drops of 0.5 liters or more as actual consumption
        if (drop >= 0.5) {
          fuelDelta = drop;
        }
      }

      await client.query(
        `UPDATE trips 
         SET distance = distance + $1,
             fuel_used = fuel_used + $2,
             total_idle_time = total_idle_time + $3,
             live_speed = $4,
             power = $5,
             live_fuel_count = $6,
             status = CASE WHEN $5 = true AND $4 = 0 THEN 'idle' WHEN $5 = true AND $4 > 0 THEN 'running' ELSE 'halted' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [deltaDistance, fuelDelta, idleDeltaSeconds, speed, power, fuel, trip.id]
      );
    }

    // 4. Check for abnormal vibration (Theft / Tampering)
    // If engine is OFF but vibration exceeds threshold (e.g. 2.5)
    if (power === false && vibration !== undefined && vibration > 2.5) {
      // Check if an alert was recently created to avoid spam
      const recentAlertRes = await client.query(
        `SELECT id FROM alerts WHERE vehicle_plate = $1 AND type = 'Vibration / Tampering' AND detected_at > NOW() - INTERVAL '1 hour'`,
        [plate]
      );
      if (recentAlertRes.rows.length === 0) {
        await client.query(
          `INSERT INTO alerts (uid, vehicle_plate, type, message, severity, category, status)
           VALUES ($1, $2, 'Vibration / Tampering', 'Abnormal vibration detected while engine is OFF. Possible theft or towing attempt.', 'critical', 'security', 'New')`,
          [uid, plate]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Telemetry updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    handleError(res, 'Error processing telemetry', err);
  } finally {
    client.release();
  }
};

module.exports = {
  ingestTelemetry
};
