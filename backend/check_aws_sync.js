// Test script to check PM2 app location & response details from AWS server
require('dotenv').config();
const https = require('https');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { user_id: 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2', email: 'guruhugar0310@gmail.com', exp: Math.floor(Date.now()/1000) + 3600 },
  'test-secret'
);

function postSync() {
  return new Promise((resolve) => {
    const body = JSON.stringify({ full_name: 'Test User', role: 'fleet_owner' });
    const req = https.request({
      hostname: '16-112-99-7.nip.io',
      path: '/api/users/sync',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body)
      },
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 'ERR', body: e.message }));
    req.write(body);
    req.end();
  });
}

postSync().then(r => {
  console.log('/api/users/sync status:', r.status);
  console.log('/api/users/sync body:', r.body);
  process.exit(0);
});
