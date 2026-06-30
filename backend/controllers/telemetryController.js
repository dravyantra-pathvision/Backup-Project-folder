// controllers/telemetryController.js
const { pool } = require('../config/dbconfig');
const { getDistanceFromLatLonInKm } = require('../utils/helpers');
const { handleError } = require('../utils/responseHandler');

const ingestTelemetry = async (req, res) => {
  const { deviceId, lat, lng, speed, power, fuel, timestamp } = req.body;

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
           loc = CASE WHEN loc IS NULL OR loc = '' THEN $7 ELSE loc END
       WHERE device_id = $8`,
      [lat, lng, speed, fuel, power, JSON.stringify([[lat, lng]]), `Lat: ${lat}, Lng: ${lng}`, deviceId]
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

      // Calculate fuel delta
      let fuelDelta = 0;
      if (oldFuel !== null && fuel !== null && oldFuel > fuel) {
        // Simple delta. Note: if oldFuel < fuel, it might be a refill. We ignore negative deltas for fuel_used.
        fuelDelta = oldFuel - fuel;
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
