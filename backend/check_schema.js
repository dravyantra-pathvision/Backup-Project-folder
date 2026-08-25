require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function run() {
  // Vehicles columns
  const v = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' ORDER BY ordinal_position");
  console.log('VEHICLES columns:', v.rows.map(c => c.column_name).join(', '));

  // Trips columns
  const t = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'trips' ORDER BY ordinal_position");
  console.log('TRIPS columns:', t.rows.map(c => c.column_name).join(', '));

  // Sample vehicles
  const vs = await pool.query('SELECT * FROM vehicles LIMIT 3');
  console.log('\nSample vehicles rows:', JSON.stringify(vs.rows, null, 2));

  // Sample trips
  const ts = await pool.query('SELECT * FROM trips LIMIT 3');
  console.log('\nSample trips rows:', JSON.stringify(ts.rows, null, 2));

  // Check users: emailVerified vs not
  const us = await pool.query('SELECT uid, email, role, account_status FROM users ORDER BY created_at DESC');
  console.log('\nAll users:', JSON.stringify(us.rows, null, 2));

  await pool.end();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
