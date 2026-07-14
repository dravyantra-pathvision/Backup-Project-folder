const pool = require('./config/dbconfig').pool;

async function dropPincode() {
  try {
    const client = await pool.connect();
    await client.query('ALTER TABLE fleet_onboarding DROP COLUMN IF EXISTS pincode;');
    client.release();
    console.log('pincode column dropped');
  } catch (err) {
    console.error('Error dropping pincode', err);
  } finally {
    process.exit(0);
  }
}

dropPincode();
