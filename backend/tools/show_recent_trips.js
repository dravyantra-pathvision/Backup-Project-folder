const { pool } = require('../config/dbconfig');

async function show() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, uid, updated_at, current_mileage, fuel_saved, fuel_wasted, manual_override FROM trips ORDER BY updated_at DESC LIMIT 10");
    console.log('recent trips:');
    for (const r of res.rows) console.log(r);
  } catch (e) {
    console.error('Failed to read recent trips:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (require.main === module) show();

module.exports = { show };
