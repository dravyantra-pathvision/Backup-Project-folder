const https = require('https');

const API_URL = 'https://16-112-99-7.nip.io/api/telemetry';
const DEVICE_ID = 'TEST_TRUCK_001';

// We will simulate a sequence of events.
// 1. Normal driving
// 2. Speeding (speed > 80)
// 3. Normal driving
// 4. Fuel Theft (Fuel drops by 20 liters instantly)
// 5. Idling (Speed 0, engine ON for a while)

const events = [
  { lat: 19.1000, lng: 72.9000, speed: 40, power: true, fuel: 100 },
  { lat: 19.1010, lng: 72.9010, speed: 50, power: true, fuel: 99.8 },
  { lat: 19.1020, lng: 72.9020, speed: 55, power: true, fuel: 99.6 },
  
  // OVERSPEED EVENT
  { lat: 19.1030, lng: 72.9030, speed: 85, power: true, fuel: 99.4 },
  { lat: 19.1040, lng: 72.9040, speed: 90, power: true, fuel: 99.2 },
  { lat: 19.1050, lng: 72.9050, speed: 45, power: true, fuel: 99.0 },
  
  // FUEL THEFT EVENT (sudden drop of 15 liters)
  { lat: 19.1060, lng: 72.9060, speed: 40, power: true, fuel: 84.0 },
  { lat: 19.1070, lng: 72.9070, speed: 40, power: true, fuel: 83.8 },
  
  // IDLING EVENT (Speed 0, engine ON for a few ticks to trigger idle)
  { lat: 19.1080, lng: 72.9080, speed: 0, power: true, fuel: 83.7 },
  { lat: 19.1080, lng: 72.9080, speed: 0, power: true, fuel: 83.6 },
  { lat: 19.1080, lng: 72.9080, speed: 0, power: true, fuel: 83.5 },
  { lat: 19.1080, lng: 72.9080, speed: 0, power: true, fuel: 83.4 },
  { lat: 19.1080, lng: 72.9080, speed: 0, power: true, fuel: 83.3 },
  { lat: 19.1080, lng: 72.9080, speed: 0, power: false, fuel: 83.3 } // Engine off
];

function sendTelemetry(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      deviceId: DEVICE_ID,
      lat: data.lat,
      lng: data.lng,
      speed: data.speed,
      power: data.power,
      fuel: data.fuel,
      timestamp: Date.now()
    });

    const url = new URL(API_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      rejectUnauthorized: false // Ignore self-signed/Nginx issues if any
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    req.on('error', e => reject(e));
    req.write(payload);
    req.end();
  });
}

async function runSimulation() {
  console.log(`Starting cloud simulation for device ${DEVICE_ID}...\n`);
  for (let i = 0; i < events.length; i++) {
    console.log(`[Tick ${i+1}/${events.length}] Sending -> Speed: ${events[i].speed}km/h | Fuel: ${events[i].fuel}L`);
    try {
      const response = await sendTelemetry(events[i]);
      if (response.status === 200 || response.status === 201) {
        console.log(`  <- Response: ${response.status} OK`);
      } else {
        console.log(`  <- Response: ${response.status} - ${response.body}`);
      }
    } catch (e) {
      console.error(`  <- Error: ${e.message}`);
    }
    // Wait 2 seconds between pings
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log('\nSimulation complete! Check your Admin Dashboard or Fleet App for new alerts.');
}

runSimulation();
