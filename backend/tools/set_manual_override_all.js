const { pool } = require('../config/dbconfig');

async function setAll() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`UPDATE trips SET manual_override = TRUE WHERE manual_override IS NOT TRUE`);
    await client.query('COMMIT');
    console.log(`manual_override set to true for ${res.rowCount} rows`);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (er) {}
    console.error('Failed to set manual_override on trips:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (require.main === module) {
  setAll();
}

module.exports = { setAll };
