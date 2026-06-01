const http = require('http');
const tripId = process.argv[2] || 'TRP-4403';
const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/trips/${encodeURIComponent(tripId)}/notify`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try { console.log('Body:', JSON.parse(data)); } catch(e){ console.log('Body:', data); }
  });
});
req.on('error', (e) => { console.error('request error', e && e.message); });
req.end();
