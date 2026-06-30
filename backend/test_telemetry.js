const http = require('http');

const payload = JSON.stringify({
  deviceId: "TEST_DEVICE_001",
  lat: 19.1000,
  lng: 72.9000,
  speed: 45,
  power: true,
  fuel: 98,
  timestamp: Date.now()
});

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/telemetry',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${data}`);
  });
});

req.on('error', e => console.error(`Problem with request: ${e.message}`));
req.write(payload);
req.end();
