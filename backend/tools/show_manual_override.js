const { pool } = require('../config/dbconfig');

async function show() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, uid, manual_override FROM trips ORDER BY id');
    console.log('trips manual_override:');
    for (const r of res.rows) {
      console.log(r);
    }
  } catch (e) {
    console.error('Failed to read trips:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (require.main === module) show();

module.exports = { show };
