// d:\DY\backend\run_live_fleet_simulation.js
/**
 * Master Fleet Telemetry Live Simulation Script
 * Simulates 3 real-world trucks with rich dynamic events.
 * AUTOMATICALLY STOPS & MARKS TRIPS COMPLETED ONCE DESTINATION IS REACHED!
 */

require('dotenv').config();
const axios = require('axios');
const { pool } = require('./config/dbconfig');
const tripCompletionService = require('./services/tripCompletionService');

const FLEET_OWNER_UID = process.env.FLEET_OWNER_UID || 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';
const FLEET_OWNER_EMAIL = process.env.FLEET_OWNER_EMAIL || 'guruhugar0310@gmail.com';
const TARGET_API = process.env.API_BASE_URL || 'https://16-112-99-7.nip.io/api/telemetry';

// ── Waypoints for realistic routes ──────────────────────────────────────────
const ROUTE_BLR_HYD = [
  { lat: 12.9716, lng: 77.5946 }, // Bangalore
  { lat: 13.3409, lng: 77.1010 }, // Tumkur
  { lat: 14.2285, lng: 76.3980 }, // Chitradurga
  { lat: 15.1394, lng: 76.9214 }, // Ballari
  { lat: 15.8281, lng: 78.0373 }, // Kurnool
  { lat: 16.7488, lng: 78.0035 }, // Mahbubnagar
  { lat: 17.3850, lng: 78.4867 }, // Hyderabad
];

const ROUTE_BLR_VJA = [
  { lat: 12.9716, lng: 77.5946 }, // Bangalore
  { lat: 13.1986, lng: 78.1398 }, // Kolar
  { lat: 13.2172, lng: 79.1003 }, // Chittoor
  { lat: 13.6288, lng: 79.4192 }, // Tirupati
  { lat: 14.4426, lng: 79.9865 }, // Nellore
  { lat: 15.5057, lng: 80.0499 }, // Ongole
  { lat: 16.5062, lng: 80.6480 }, // Vijayawada
];

const ROUTE_KLB_BLR = [
  { lat: 17.3297, lng: 76.8343 }, // Kalaburgi
  { lat: 16.8302, lng: 76.9419 }, // Yadgir
  { lat: 16.2076, lng: 77.3556 }, // Raichur
  { lat: 15.1394, lng: 76.9214 }, // Ballari
  { lat: 14.2285, lng: 76.3980 }, // Chitradurga
  { lat: 13.3409, lng: 77.1010 }, // Tumkur
  { lat: 12.9716, lng: 77.5946 }, // Bangalore
];

function generateRoutePoints(waypoints, numPoints = 2500) {
  const points = [];
  const segments = waypoints.length - 1;
  const pointsPerSegment = Math.floor(numPoints / segments);

  for (let s = 0; s < segments; s++) {
    const start = waypoints[s];
    const end = waypoints[s + 1];

    for (let i = 0; i < pointsPerSegment; i++) {
      const ratio = i / pointsPerSegment;
      points.push({
        lat: start.lat + (end.lat - start.lat) * ratio,
        lng: start.lng + (end.lng - start.lng) * ratio,
      });
    }
  }
  points.push(waypoints[waypoints.length - 1]);
  return points;
}

const pointsBlrHyd = generateRoutePoints(ROUTE_BLR_HYD, 2500);
const pointsBlrVja = generateRoutePoints(ROUTE_BLR_VJA, 2800);
const pointsKlbBlr = generateRoutePoints(ROUTE_KLB_BLR, 2500);

const fleetConfig = [
  {
    driverName: 'Kartik',
    driverId: 'DRV-KARTIK-01',
    plate: 'KA 01 AB 1234',
    deviceId: 'DEV-SIM-001',
    tripId: 'TRIP-BLR-HYD-01',
    from: 'Bangalore',
    to: 'Hyderabad',
    routePoints: pointsBlrHyd,
    fuel: 95.0,
    baseSpeed: 65,
    initialDriverScore: 100,
    isCompleted: false,
  },
  {
    driverName: 'Anand',
    driverId: 'DRV-ANAND-02',
    plate: 'KA 02 CD 5678',
    deviceId: 'DEV-SIM-002',
    tripId: 'TRIP-BLR-VJA-02',
    from: 'Bangalore',
    to: 'Vijayawada',
    routePoints: pointsBlrVja,
    fuel: 90.0,
    baseSpeed: 60,
    initialDriverScore: 100,
    isCompleted: false,
  },
  {
    driverName: 'Chakravarthi',
    driverId: 'DRV-CHAKRA-03',
    plate: 'KA 03 EF 9012',
    deviceId: 'DEV-SIM-003',
    tripId: 'TRIP-KLB-BLR-03',
    from: 'Kalaburgi',
    to: 'Bangalore',
    routePoints: pointsKlbBlr,
    fuel: 88.0,
    baseSpeed: 68,
    initialDriverScore: 100,
    isCompleted: false,
  },
];

async function setupDatabaseEntities() {
  const client = await pool.connect();
  try {
    console.log('====================================================');
    console.log(`⚡ Setting up Fleet Data for: ${FLEET_OWNER_EMAIL}`);
    console.log('====================================================');

    await client.query(
      `UPDATE users SET role = 'fleet_owner', account_status = 'Active' WHERE uid = $1`,
      [FLEET_OWNER_UID]
    );

    await client.query(`
      INSERT INTO fleet_onboarding (uid, company_name, contact_number, status, city, state)
      VALUES ($1, 'airlines', '9876543210', 'Approved', 'Bangalore', 'Karnataka')
      ON CONFLICT (uid) DO UPDATE SET status = 'Approved', company_name = 'airlines'
    `, [FLEET_OWNER_UID]);

    for (const item of fleetConfig) {
      await client.query(`
        INSERT INTO vehicles (plate, device_id, uid, driver, status, lat, lng, speed, fuel, is_active, is_deleted)
        VALUES ($1, $2, $3, $4, 'in_transit', $5, $6, $7, $8, true, false)
        ON CONFLICT (plate) DO UPDATE 
        SET device_id = $2, uid = $3, driver = $4, status = 'in_transit', 
            lat = $5, lng = $6, speed = $7, fuel = $8, is_active = true, is_deleted = false
      `, [
        item.plate, item.deviceId, FLEET_OWNER_UID, item.driverName,
        item.routePoints[0].lat, item.routePoints[0].lng, item.baseSpeed, item.fuel,
      ]);

      await client.query(`
        INSERT INTO devices (device_id, device_type, status, assigned_organization, assigned_vehicle)
        VALUES ($1, 'GPS Tracker', 'Active', $2, $3)
        ON CONFLICT (device_id) DO UPDATE 
        SET status = 'Active', assigned_organization = $2, assigned_vehicle = $3
      `, [item.deviceId, FLEET_OWNER_UID, item.plate]);

      await client.query(`
        INSERT INTO drivers (id, uid, name, phone, lic, vehicle, status, score, is_deleted)
        VALUES ($1, $2, $3, '9876543210', 'DL-IND-888', $4, 'Active', $5, false)
        ON CONFLICT (id) DO UPDATE 
        SET uid = $2, name = $3, vehicle = $4, status = 'Active', score = $5, is_deleted = false
      `, [item.driverId, FLEET_OWNER_UID, item.driverName, item.plate, item.initialDriverScore]);

      await client.query(`
        INSERT INTO trips (
          id, uid, vehicle, driver, from_location, to_location, status, trip_completed, is_deleted,
          distance, fuel_used, fuel_wasted, fuel_saved, money_wasted, money_saved, 
          idle_duration, total_idle_time, idle_money_wasted, speeding_fuel_wasted, 
          theft_fuel_loss, theft_money_loss, live_speed, power, progress, date
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 'in progress', false, false,
          0, 0, 0, 0, 0, 0, 
          0, 0, 0, 0, 
          0, 0, $7, true, 0, CURRENT_DATE::text
        )
        ON CONFLICT (id) DO UPDATE 
        SET vehicle = $3, driver = $4, from_location = $5, to_location = $6, 
            status = 'in progress', trip_completed = false, is_deleted = false,
            power = true, distance = 0, fuel_used = 0, fuel_wasted = 0, fuel_saved = 0,
            money_wasted = 0, money_saved = 0, total_idle_time = 0, idle_money_wasted = 0,
            speeding_fuel_wasted = 0, theft_fuel_loss = 0, theft_money_loss = 0,
            overspeed_events = 0, harsh_braking_events = 0, rapid_accel_events = 0, trip_score = 100
      `, [
        item.tripId, FLEET_OWNER_UID, item.plate, item.driverName, item.from, item.to, item.baseSpeed,
      ]);

      console.log(`✅ [SETUP] Driver: ${item.driverName} | Vehicle: ${item.plate} | Trip: ${item.tripId}`);
    }

    console.log('====================================================');
    console.log('🚀 All Entities Prepped & Ready for Simulation!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Setup error:', err);
  } finally {
    client.release();
  }
}

async function sendTelemetry(payload) {
  try {
    const response = await axios.post(TARGET_API, payload, { timeout: 3000 });
    return response.status;
  } catch (err) {
    return err.response ? err.response.status : 'CONN_ERR';
  }
}

async function startLiveSimulation() {
  await setupDatabaseEntities();

  let tick = 0;
  const stopTime = new Date();
  stopTime.setHours(23, 59, 59, 999);

  console.log(`📡 Starting Fleet Telemetry Stream to ${TARGET_API}`);
  console.log('----------------------------------------------------');

  const indices = [0, 0, 0];
  const currentFuels = [95.0, 90.0, 88.0];

  const interval = setInterval(async () => {
    const now = new Date();
    if (now >= stopTime) {
      console.log('⏰ Reached scheduled stop time. Stopping simulation.');
      clearInterval(interval);
      process.exit(0);
    }

    tick++;
    console.log(`\n--- [Tick #${tick} - ${now.toLocaleTimeString('en-IN')}] ---`);

    let activeCount = 0;

    for (let i = 0; i < fleetConfig.length; i++) {
      const config = fleetConfig[i];
      if (config.isCompleted) {
        console.log(`🏁 ${config.driverName} (${config.plate}) | TRIP COMPLETED AT DESTINATION`);
        continue;
      }

      activeCount++;

      // Check if vehicle has reached destination
      if (indices[i] >= config.routePoints.length - 1) {
        config.isCompleted = true;
        console.log(`\n🎯 [DESTINATION REACHED] Driver: ${config.driverName} (${config.plate}) reached ${config.to}!`);
        console.log(`   Finalizing trip ${config.tripId}...`);
        
        // Auto-complete trip via completion pipeline
        await tripCompletionService.onTripCompleted(config.tripId, FLEET_OWNER_UID);
        continue;
      }

      const pointIndex = Math.min(indices[i], config.routePoints.length - 1);
      const point = config.routePoints[pointIndex];
      
      // Advance route points per tick (~460 meters per 4s tick)
      indices[i] += 2;

      let speed = config.baseSpeed + (Math.floor(Math.random() * 9) - 4);
      let power = true;
      let fuel = currentFuels[i];
      let eventNotice = '';

      // ── DYNAMIC RICH EVENT SCENARIOS ─────────────────────────────────────
      
      // Driver 1: Kartik (KA 01 AB 1234)
      if (i === 0) {
        if (tick >= 8 && tick <= 18) {
          speed = 96 + (tick % 5);
          eventNotice = '🚨 [OVERSPEED EVENT > 90 km/h - Speeding Waste & Penalty]';
        } else if (tick === 22) {
          speed = 10;
          eventNotice = '⚠️ [SUDDEN HARSH BRAKING EVENT - Score Reduced]';
        } else if (tick >= 30 && tick <= 76) {
          speed = 0;
          power = true;
          eventNotice = '⏳ [PROLONGED IDLING EVENT - Engine ON @ 0 km/h (> 3 mins)]';
        }
      }

      // Driver 2: Anand (KA 02 CD 5678)
      if (i === 1) {
        if (tick === 15) {
          power = false;
          speed = 0;
          fuel = Math.max(5.0, fuel - 12.5);
          currentFuels[i] = fuel;
          eventNotice = '⛽ [FUEL THEFT EVENT - 12.5L Sudden Theft Detected!]';
        } else if (tick >= 25 && tick <= 35) {
          speed = 98;
          eventNotice = '🚨 [OVERSPEED EVENT > 90 km/h - Speeding Waste & Penalty]';
        } else if (tick === 45) {
          power = false;
          speed = 0;
          fuel = Math.min(100.0, fuel + 40.0);
          currentFuels[i] = fuel;
          eventNotice = '⛽ [FUEL REFILL EVENT - 40.0L Fuel Refill Detected!]';
        }
      }

      // Driver 3: Chakravarthi (KA 03 EF 9012)
      if (i === 2) {
        if (tick === 12) {
          speed = 8;
          eventNotice = '⚠️ [SUDDEN HARSH BRAKING EVENT - Score Reduced]';
        } else if (tick >= 20 && tick <= 30) {
          speed = 102;
          eventNotice = '🚨 [HIGH OVERSPEED EVENT > 100 km/h - High Waste]';
        } else if (tick >= 40 && tick <= 85) {
          speed = 0;
          power = true;
          eventNotice = '⏳ [PROLONGED IDLING AT TOLL PLAZA (> 3 mins)]';
        }
      }

      // Normal gradual fuel consumption when vehicle is moving
      if (speed > 0 && power === true) {
        fuel = Math.max(5.0, fuel - 0.05);
        currentFuels[i] = fuel;
      }

      const payload = {
        deviceId: config.deviceId,
        lat: Number(point.lat.toFixed(6)),
        lng: Number(point.lng.toFixed(6)),
        speed: speed,
        power: power,
        fuel: Number(fuel.toFixed(2)),
        timestamp: Date.now(),
      };

      const res = await sendTelemetry(payload);
      console.log(
        `🚛 ${config.driverName} (${config.plate}) | Speed: ${speed} km/h | Fuel: ${fuel.toFixed(1)}L | Loc: (${payload.lat}, ${payload.lng}) ${eventNotice} -> HTTP ${res}`
      );
    }

    if (activeCount === 0) {
      console.log('\n🎉 ALL VEHICLES HAVE REACHED THEIR DESTINATIONS!');
      console.log('✅ All trips completed and finalized. Stopping simulation daemon.');
      clearInterval(interval);
      process.exit(0);
    }
  }, 4000);
}

startLiveSimulation();
