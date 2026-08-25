// FULL PIPELINE DIAGNOSTICS
// Checks: DB tables, users, trips, vehicles, drivers, alerts, Firebase config, SMTP

require('dotenv').config();
const { pool } = require('./config/dbconfig');
const admin = require('./config/firebase');
const notificationService = require('./services/notificationService');
const jwt = require('jsonwebtoken');

async function run() {
  console.log('='.repeat(70));
  console.log('  DRAVYANTRA FULL PIPELINE DIAGNOSTICS');
  console.log('='.repeat(70));

  // ─── 1. DATABASE CONNECTION ──────────────────────────────────────────────
  console.log('\n[1] DATABASE CONNECTION');
  try {
    const r = await pool.query('SELECT version(), NOW() as server_time');
    console.log('  ✅ Connected to PostgreSQL:', r.rows[0].version.split(',')[0]);
    console.log('  ✅ DB Server Time:', r.rows[0].server_time);
  } catch (e) {
    console.error('  ❌ DB Connection FAILED:', e.message);
    process.exit(1);
  }

  // ─── 2. DATABASE TABLES ──────────────────────────────────────────────────
  console.log('\n[2] DATABASE TABLES');
  try {
    const tables = await pool.query(`
      SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename::text)) as size
      FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    tables.rows.forEach(t => console.log(`  📋 ${t.tablename} (${t.size})`));
  } catch (e) {
    console.error('  ❌ Failed to list tables:', e.message);
  }

  // ─── 3. USERS TABLE ─────────────────────────────────────────────────────
  console.log('\n[3] USERS TABLE');
  try {
    const cols = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
    console.log('  Columns:', cols.rows.map(c => `${c.column_name}(${c.data_type})`).join(', '));
    const users = await pool.query('SELECT uid, email, full_name, role, created_at FROM users ORDER BY created_at DESC');
    console.log(`  Total users: ${users.rows.length}`);
    users.rows.forEach(u => console.log(`  👤 ${u.email} | role=${u.role} | uid=${u.uid.substring(0,20)}...`));
  } catch (e) {
    console.error('  ❌ Users query failed:', e.message);
  }

  // ─── 4. VEHICLES TABLE ──────────────────────────────────────────────────
  console.log('\n[4] VEHICLES TABLE');
  try {
    const vehicles = await pool.query('SELECT plate, device_id, status, driver, owner_uid FROM vehicles LIMIT 10');
    console.log(`  Total vehicles: ${vehicles.rows.length}`);
    vehicles.rows.forEach(v => console.log(`  🚛 ${v.plate} | device=${v.device_id} | status=${v.status} | driver=${v.driver} | owner=${v.owner_uid?.substring(0,20)}`));
  } catch (e) {
    console.error('  ❌ Vehicles query failed:', e.message);
  }

  // ─── 5. TRIPS TABLE ─────────────────────────────────────────────────────
  console.log('\n[5] TRIPS TABLE');
  try {
    const trips = await pool.query('SELECT id, vehicle, driver, status, owner_uid, created_at FROM trips ORDER BY created_at DESC LIMIT 5');
    console.log(`  Total recent trips: ${trips.rows.length}`);
    trips.rows.forEach(t => console.log(`  🛣️  ${t.id} | vehicle=${t.vehicle} | status=${t.status} | owner=${t.owner_uid?.substring(0,20)}`));
  } catch (e) {
    console.error('  ❌ Trips query failed:', e.message);
  }

  // ─── 6. FIREBASE AUTH ────────────────────────────────────────────────────
  console.log('\n[6] FIREBASE ADMIN AUTH');
  try {
    const listResult = await admin.auth().listUsers(5);
    console.log(`  ✅ Firebase Admin connected. Users in Firebase Auth (first 5):`);
    listResult.users.forEach(u => {
      console.log(`  🔑 ${u.email || 'no-email'} | emailVerified=${u.emailVerified} | uid=${u.uid.substring(0,20)}...`);
    });
  } catch (e) {
    console.error('  ❌ Firebase Admin FAILED:', e.message, e.code);
  }

  // ─── 7. FIREBASE vs DB USERS SYNC CHECK ─────────────────────────────────
  console.log('\n[7] FIREBASE vs DATABASE SYNC CHECK');
  try {
    const listResult = await admin.auth().listUsers(100);
    const dbUsers = await pool.query('SELECT uid, email FROM users');
    const dbUids = new Set(dbUsers.rows.map(u => u.uid));
    const dbEmails = new Set(dbUsers.rows.map(u => u.email));

    let missingInDB = 0;
    for (const fbUser of listResult.users) {
      if (!dbUids.has(fbUser.uid) && !dbEmails.has(fbUser.email)) {
        console.log(`  ⚠️  Firebase user NOT in DB: ${fbUser.email} (uid=${fbUser.uid.substring(0,20)})`);
        missingInDB++;
      }
    }
    if (missingInDB === 0) {
      console.log('  ✅ All Firebase users are synced to the database!');
    } else {
      console.log(`  ❌ ${missingInDB} Firebase user(s) are NOT in the database!`);
    }
  } catch (e) {
    console.error('  ❌ Sync check failed:', e.message);
  }

  // ─── 8. TOKEN DECODE TEST ────────────────────────────────────────────────
  console.log('\n[8] JWT TOKEN DECODE TEST');
  try {
    // Create a sample token structure (mimick what Firebase returns)
    const samplePayload = { user_id: 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2', email: 'guruhugar0310@gmail.com', exp: Math.floor(Date.now()/1000) + 3600 };
    const sampleToken = jwt.sign(samplePayload, 'test-secret');
    const decoded = jwt.decode(sampleToken);
    const uid = decoded.user_id || decoded.sub || decoded.uid;
    console.log('  ✅ JWT decode working. uid extracted:', uid);
    console.log('  ✅ email extracted:', decoded.email);
  } catch (e) {
    console.error('  ❌ JWT decode FAILED:', e.message);
  }

  // ─── 9. SMTP EMAIL TEST ──────────────────────────────────────────────────
  console.log('\n[9] SMTP EMAIL');
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.verify();
    console.log('  ✅ SMTP connected to:', process.env.SMTP_HOST);
    console.log('  ✅ Sending from:', process.env.SMTP_USER);
    console.log('  ✅ SMTP_PASS is set:', process.env.SMTP_PASS ? `${process.env.SMTP_PASS.length} chars` : 'MISSING!');
  } catch (e) {
    console.error('  ❌ SMTP FAILED:', e.message);
  }

  // ─── 10. AWS BACKEND HEALTH ──────────────────────────────────────────────
  console.log('\n[10] AWS BACKEND HEALTH');
  try {
    const https = require('https');
    await new Promise((resolve) => {
      const req = https.get('https://16-112-99-7.nip.io/api/health', (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('  ✅ AWS Backend is reachable:', body.substring(0, 80));
          } else {
            console.log(`  ⚠️  AWS Backend responded with status ${res.statusCode}:`, body.substring(0, 80));
          }
          resolve();
        });
      });
      req.on('error', (e) => {
        console.error('  ❌ AWS Backend unreachable:', e.message);
        resolve();
      });
      req.setTimeout(5000, () => { console.error('  ❌ AWS Backend TIMEOUT'); req.destroy(); resolve(); });
    });
  } catch (e) {
    console.error('  ❌ AWS backend check failed:', e.message);
  }

  // ─── 11. AWS send-verification ENDPOINT ─────────────────────────────────
  console.log('\n[11] AWS SEND-VERIFICATION ENDPOINT TEST');
  try {
    const https = require('https');
    await new Promise((resolve) => {
      const body = JSON.stringify({ email: 'guruhugar0310@gmail.com' });
      const req = https.request({
        hostname: '16-112-99-7.nip.io',
        path: '/api/auth/send-verification',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('  ✅ AWS send-verification: OK');
          } else {
            console.log(`  ❌ AWS send-verification returned ${res.statusCode}:`, data.substring(0, 120));
          }
          resolve();
        });
      });
      req.on('error', e => { console.error('  ❌ AWS send-verification error:', e.message); resolve(); });
      req.setTimeout(8000, () => { console.error('  ❌ AWS send-verification TIMEOUT'); req.destroy(); resolve(); });
      req.write(body);
      req.end();
    });
  } catch (e) {
    console.error('  ❌ send-verification test failed:', e.message);
  }

  // ─── 12. ENV VARIABLE SUMMARY ────────────────────────────────────────────
  console.log('\n[12] LOCAL .ENV VARIABLE SUMMARY');
  const envVars = ['PORT', 'DATABASE_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SUPER_ADMIN_UIDS'];
  envVars.forEach(key => {
    const val = process.env[key];
    if (!val) {
      console.log(`  ❌ ${key}: MISSING`);
    } else if (key === 'SMTP_PASS') {
      console.log(`  ✅ ${key}: ${'*'.repeat(val.length)} (${val.length} chars)`);
    } else if (key === 'DATABASE_URL') {
      console.log(`  ✅ ${key}: ${val.substring(0, 30)}...`);
    } else {
      console.log(`  ✅ ${key}: ${val}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('  DIAGNOSTICS COMPLETE');
  console.log('='.repeat(70));
  await pool.end();
  process.exit(0);
}

run().catch(e => {
  console.error('Fatal error in diagnostics:', e);
  process.exit(1);
});
