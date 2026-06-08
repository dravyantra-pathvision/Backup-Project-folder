const http = require('http');
const tripId = process.argv[2] || 'TRP-4406';
const payload = JSON.stringify({ liveSpeed: 85, power: true, _updatedAt: new Date().toISOString() });
const opts = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/trips/${encodeURIComponent(tripId)}`,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('PUT response status:', res.statusCode);
    console.log('Body:', d);
  });
});

req.on('error', (e) => { console.error('request error', e && e.message); });
req.write(payload);
req.end();
