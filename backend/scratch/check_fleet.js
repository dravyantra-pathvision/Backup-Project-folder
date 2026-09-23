require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function checkFleet() {
  const client = await pool.connect();
  try {
    const uid = 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';
    
    const vehicles = await client.query('SELECT plate, device_id, driver, status, lat, lng, speed, fuel, is_active FROM vehicles WHERE uid = $1', [uid]);
    console.log('--- Vehicles ---');
    console.table(vehicles.rows);

    const drivers = await client.query('SELECT id, name, vehicle, status, score FROM drivers WHERE uid = $1', [uid]);
    console.log('--- Drivers ---');
    console.table(drivers.rows);

    const devices = await client.query('SELECT device_id, assigned_vehicle, status FROM devices WHERE assigned_organization = $1', [uid]);
    console.log('--- Devices ---');
    console.table(devices.rows);

    const trips = await client.query('SELECT id, vehicle, driver, from_location, to_location, status, trip_completed, progress FROM trips WHERE uid = $1', [uid]);
    console.log('--- Trips ---');
    console.table(trips.rows);

  } catch (err) {
    console.error('DB error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkFleet();
