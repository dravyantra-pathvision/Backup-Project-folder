require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function checkSchema() {
  const tables = ['vehicles', 'drivers', 'trips', 'alerts', 'devices'];
  for (const table of tables) {
    const r = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
    );
    console.log(`\n=== ${table} ===`);
    r.rows.forEach(row => console.log(`  ${row.column_name} (${row.data_type})`));
  }

  // Sample some plate values from vehicles
  const veh = await pool.query('SELECT plate, driver, uid FROM vehicles LIMIT 5');
  console.log('\n=== sample vehicles ===');
  console.table(veh.rows);

  // Sample some drivers
  const drv = await pool.query('SELECT id, name, uid FROM drivers LIMIT 5');
  console.log('\n=== sample drivers ===');
  console.table(drv.rows);

  // Sample some trips
  const trp = await pool.query('SELECT vehicle, driver, uid FROM trips LIMIT 5');
  console.log('\n=== sample trips ===');
  console.table(trp.rows);

  process.exit(0);
}

checkSchema().catch(e => { console.error(e); process.exit(1); });
