// scratch/simulate_hardware.js
const http = require('http');

const API_URL = 'http://localhost:3000/api/telemetry';
// Replace this with an actual deviceId from your database
const DEVICE_ID = '123'; 

// Function to send telemetry to the backend
const sendTelemetry = (payload) => {
  const data = JSON.stringify(payload);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = http.request(API_URL, options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => responseBody += chunk);
    res.on('end', () => {
      console.log(`[${new Date().toISOString()}] Sent:`, payload.vibration !== undefined ? `Vibration: ${payload.vibration}` : `Speed: ${payload.speed}`);
      console.log(`Response: ${res.statusCode} ${responseBody}`);
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(data);
  req.end();
};

// Simulation Sequence
console.log('Starting hardware simulation...');

// 1. Normal Driving
setTimeout(() => {
  sendTelemetry({
    deviceId: DEVICE_ID,
    lat: 12.9716,
    lng: 77.5946,
    speed: 45, // moving
    power: true, // engine ON
    fuel: 48.5,
    vibration: 0.2, // normal
    timestamp: Date.now()
  });
}, 1000);

// 2. Idle State
setTimeout(() => {
  sendTelemetry({
    deviceId: DEVICE_ID,
    lat: 12.9716,
    lng: 77.5946,
    speed: 0, // not moving
    power: true, // engine ON -> Idling!
    fuel: 48.4,
    vibration: 0.1,
    timestamp: Date.now()
  });
}, 3000);

// 3. Engine OFF, but high vibration (Possible Theft/Tampering)
setTimeout(() => {
  sendTelemetry({
    deviceId: DEVICE_ID,
    lat: 12.9716,
    lng: 77.5946,
    speed: 0,
    power: false, // engine OFF
    fuel: 48.4,
    vibration: 3.5, // HIGH VIBRATION (> 2.5) -> Should trigger alert
    timestamp: Date.now()
  });
}, 5000);

// 4. Fuel Sloshing (Fuel drops by 0.2, then goes back up)
setTimeout(() => {
  sendTelemetry({
    deviceId: DEVICE_ID,
    lat: 12.9720,
    lng: 77.5950,
    speed: 50,
    power: true,
    fuel: 48.2, // Drop of 0.2 (Should be ignored by smoothing logic)
    vibration: 0.5,
    timestamp: Date.now()
  });
}, 7000);

setTimeout(() => {
  sendTelemetry({
    deviceId: DEVICE_ID,
    lat: 12.9730,
    lng: 77.5960,
    speed: 55,
    power: true,
    fuel: 47.5, // Drop of 0.7 (>= 0.5, Should be registered as fuel_used!)
    vibration: 0.6,
    timestamp: Date.now()
  });
}, 9000);
