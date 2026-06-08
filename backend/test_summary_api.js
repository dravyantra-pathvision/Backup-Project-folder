const http = require('http');

// Get an auth token from the environment or use a test token
const token = process.env.TEST_AUTH_TOKEN || 'test-token';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trips/summary',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\n✅ Backend API Response:');
      console.log(JSON.stringify(json, null, 2));
      console.log('\n📊 Key Value - Total Idle Rupees:', json.totalIdleRupees);
      process.exit(0);
    } catch (e) {
      console.log('Raw response:', data);
      process.exit(0);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.end();
