require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function run() {
  // --- Who owns the trips currently in DB? ---
  const trips = await pool.query('SELECT id, uid, vehicle, status FROM trips ORDER BY created_at DESC LIMIT 5');
  console.log('\nTrips and their uid (owner):');
  trips.rows.forEach(r => console.log(' ', r.id, '| uid:', r.uid, '| vehicle:', r.vehicle, '| status:', r.status));

  // --- What users exist? ---
  const users = await pool.query('SELECT uid, email, role FROM users ORDER BY created_at DESC');
  console.log('\nAll users and their uid:');
  users.rows.forEach(r => console.log(' ', r.uid, '| email:', r.email, '| role:', r.role));

  // --- Vehicles uid column check ---
  const vcols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'vehicles' AND column_name LIKE '%uid%'");
  console.log('\nVehicles uid-related columns:', vcols.rows.map(c => c.column_name).join(', ') || 'NONE');

  // --- Trips uid column check ---
  const tcols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'trips' AND column_name LIKE '%uid%'");
  console.log('Trips uid-related columns:', tcols.rows.map(c => c.column_name).join(', ') || 'NONE');

  // --- Are new signups (mhugarguru / gurupv47) visible in trips? ---
  for (const email of ['mhugarguru@gmail.com', 'gurupv47@gmail.com']) {
    const user = users.rows.find(u => u.email === email);
    if (user) {
      const userTrips = await pool.query('SELECT COUNT(*) FROM trips WHERE uid = $1', [user.uid]);
      const userVehicles = await pool.query("SELECT COUNT(*) FROM vehicles WHERE uid = $1", [user.uid]).catch(() => ({ rows: [{ count: 'N/A' }] }));
      console.log(`\nUser ${email} (uid=${user.uid.substring(0,20)}):`);
      console.log(`  trips: ${userTrips.rows[0].count}`);
      console.log(`  vehicles: ${userVehicles.rows[0].count}`);
    }
  }

  await pool.end();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
