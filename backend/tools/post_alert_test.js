const http = require('http');
const data = JSON.stringify({ trip: 'TG 32 HS 8976', type: 'rash_driving', message: 'Rash driving test from script' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/alerts',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => { console.log('BODY:', body); });
});

req.on('error', (e) => { console.error(`problem with request: ${e.message}`); });
req.write(data);
req.end();
