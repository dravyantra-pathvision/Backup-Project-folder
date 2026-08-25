require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function prepSimTrips() {
  const client = await pool.connect();
  try {
    console.log("Checking and preparing database vehicles, devices, drivers & trips for simulator...");

    // Get default org uid
    const userRes = await client.query(`SELECT uid FROM users LIMIT 1`);
    const uid = userRes.rows[0]?.uid || 'default_user';
    console.log("Using organization UID:", uid);

    const vehicles = [
      { plate: 'KA 33 W 1234', device_id: 'DEV-001', driver: 'Rajesh Kumar', lat: 12.971598, lng: 77.594562, trip_id: 'TRIP-1001', from: 'Bangalore Depot', to: 'Electronic City' },
      { plate: 'KA 33 W 5678', device_id: 'DEV-002', driver: 'Suresh Patel', lat: 13.082680, lng: 80.270721, trip_id: 'TRIP-1002', from: 'Chennai Central', to: 'Sriperumbudur' },
      { plate: 'KA 33 W 6777', device_id: 'DEV-003', driver: 'Amit Sharma', lat: 19.076090, lng: 72.877426, trip_id: 'TRIP-1003', from: 'Mumbai Port', to: 'Bhiwandi Hub' },
    ];

    for (const v of vehicles) {
      // 1. Ensure device exists & is assigned
      await client.query(`
        INSERT INTO devices (device_id, device_type, status, assigned_organization, assigned_vehicle)
        VALUES ($1, 'GPS Tracker', 'Active', $2, $3)
        ON CONFLICT (device_id) DO UPDATE 
        SET status = 'Active', assigned_organization = $2, assigned_vehicle = $3
      `, [v.device_id, uid, v.plate]);

      // 2. Ensure vehicle exists & device_id is linked
      await client.query(`
        INSERT INTO vehicles (plate, device_id, uid, driver, status, lat, lng, speed, fuel, is_active)
        VALUES ($1, $2, $3, $4, 'in_transit', $5, $6, 0, 50.0, true)
        ON CONFLICT (plate) DO UPDATE 
        SET device_id = $2, uid = $3, driver = $4, status = 'in_transit', lat = $5, lng = $6, speed = 0, is_active = true
      `, [v.plate, v.device_id, uid, v.driver, v.lat, v.lng]);

      // 3. Ensure driver exists
      await client.query(`
        INSERT INTO drivers (id, uid, name, phone, lic, vehicle, status, score)
        VALUES ($1, $2, $3, '9876543210', 'DL-IND-999', $4, 'Active', 95)
        ON CONFLICT (id) DO UPDATE 
        SET vehicle = $4, status = 'Active'
      `, [v.driver, uid, v.driver, v.plate]);

      // 4. Ensure active trip exists
      await client.query(`
        INSERT INTO trips (
          id, uid, vehicle, driver, from_location, to_location, status, trip_completed, 
          distance, fuel_used, fuel_wasted, fuel_saved, money_wasted, money_saved, 
          idle_duration, total_idle_time, idle_money_wasted, speeding_fuel_wasted, 
          theft_fuel_loss, theft_money_loss, live_speed, power, progress, date
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 'in progress', false, 
          0, 0, 0, 0, 0, 0, 
          0, 0, 0, 0, 
          0, 0, 0, true, 0, CURRENT_DATE::text
        )
        ON CONFLICT (id) DO UPDATE 
        SET vehicle = $3, driver = $4, from_location = $5, to_location = $6, 
            status = 'in progress', trip_completed = false, distance = 0, fuel_used = 0, 
            fuel_wasted = 0, money_wasted = 0, idle_duration = 0, total_idle_time = 0, 
            idle_money_wasted = 0, speeding_fuel_wasted = 0, theft_fuel_loss = 0, 
            theft_money_loss = 0, live_speed = 0, power = true
      `, [v.trip_id, uid, v.plate, v.driver, v.from, v.to]);

      console.log(`[READY] Vehicle: ${v.plate} | Device: ${v.device_id} | Driver: ${v.driver} | Trip: ${v.trip_id}`);
    }

    console.log("All vehicles, devices, drivers & trips prepped cleanly!");
  } catch (err) {
    console.error("Prep error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

prepSimTrips();
