const { pool } = require('../config/dbconfig');

async function addColumn() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS manual_override boolean DEFAULT false;`);
    console.log('manual_override column ensured on trips');
  } catch (e) {
    console.error('Failed to add manual_override column:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    // allow process to exit cleanly
    process.exit(0);
  }
}

if (require.main === module) {
  addColumn();
}

module.exports = { addColumn };
