// Full end-to-end connectivity test between Flutter app config and AWS backend
require('dotenv').config();
const https = require('https');
const jwt = require('jsonwebtoken');

const AWS_BASE = 'https://16-112-99-7.nip.io';

// Create a mock Bearer token that mimics Firebase structure
// Using the real UID of guruhugar0310@gmail.com from our DB
const MOCK_UID = 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';
const MOCK_EMAIL = 'guruhugar0310@gmail.com';
const mockToken = jwt.sign(
  { user_id: MOCK_UID, email: MOCK_EMAIL, exp: Math.floor(Date.now()/1000) + 3600 },
  'test-secret'
);

function request(path, method = 'GET', body = null, useAuth = true) {
  return new Promise((resolve) => {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth) headers['Authorization'] = `Bearer ${mockToken}`;

    const options = {
      hostname: '16-112-99-7.nip.io',
      path,
      method,
      headers,
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data.substring(0, 150) }));
    });

    req.on('error', (e) => resolve({ status: 'ERR', body: e.message }));
    req.setTimeout(8000, () => { resolve({ status: 'TIMEOUT', body: 'Request timed out' }); req.destroy(); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function status(code) {
  if (code === 200 || code === 201) return '✅';
  if (code === 404) return '⚠️ '; // not found but server alive
  if (code === 401) return '❌ 401';
  if (code === 500) return '❌ 500';
  if (code === 'TIMEOUT') return '⏱️ ';
  if (code === 'ERR') return '❌ ERR';
  return `⚠️  ${code}`;
}

async function run() {
  console.log('======================================================================');
  console.log('  APP ↔ AWS BACKEND CONNECTIVITY TEST');
  console.log(`  Testing: ${AWS_BASE}`);
  console.log('======================================================================\n');

  const tests = [
    // Auth endpoints (no auth needed)
    { name: 'send-verification          POST /api/auth/send-verification', path: '/api/auth/send-verification', method: 'POST', body: { email: MOCK_EMAIL }, auth: false },

    // Fleet owner data endpoints (auth required)
    { name: 'trips                      GET  /api/trips', path: '/api/trips', auth: true },
    { name: 'vehicles                   GET  /api/vehicles', path: '/api/vehicles', auth: true },
    { name: 'drivers                    GET  /api/drivers', path: '/api/drivers', auth: true },
    { name: 'alerts                     GET  /api/alerts', path: '/api/alerts', auth: true },
    { name: 'fuel logs                  GET  /api/fuel_logs', path: '/api/fuel_logs', auth: true },
    { name: 'trips/summary              GET  /api/trips/summary', path: '/api/trips/summary', auth: true },
    { name: 'fleet-settings             GET  /api/fleet-settings', path: '/api/fleet-settings', auth: true },
    { name: 'reports schedules          GET  /api/reports/schedules', path: '/api/reports/schedules', auth: true },
    { name: 'user sync                  POST /api/users/sync', path: '/api/users/sync', method: 'POST', body: { full_name: 'Test User', role: 'fleet_owner' }, auth: true },
    { name: 'onboarding status          GET  /api/onboarding/status', path: '/api/onboarding/status', auth: true },
    { name: 'notifications              GET  /api/notifications', path: '/api/notifications', auth: true },
    { name: 'support tickets            GET  /api/support/tickets', path: '/api/support/tickets', auth: true },
    { name: 'analytics fleet            GET  /api/analytics/fleet', path: '/api/analytics/fleet', auth: true },
  ];

  let passed = 0, failed = 0;

  for (const t of tests) {
    const result = await request(t.path, t.method || 'GET', t.body || null, t.auth !== false);
    const s = status(result.status);
    const ok = result.status === 200 || result.status === 201;
    if (ok) passed++; else failed++;
    console.log(`  ${s}  ${t.name}`);
    if (!ok && result.body) {
      console.log(`         Response: ${result.body}`);
    }
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`  RESULTS: ${passed}/${tests.length} endpoints healthy | ${failed} failed`);

  if (failed === 0) {
    console.log('  🎉 ALL ENDPOINTS CONNECTED AND HEALTHY!');
  } else {
    console.log('  ⚠️  Some endpoints need attention (see above)');
  }
  console.log('======================================================================');

  process.exit(0);
}

run();
