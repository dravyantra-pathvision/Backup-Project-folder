const { pool } = require('./config/dbconfig');

async function approveAll() {
  try {
    const res = await pool.query("UPDATE fleet_onboarding SET status = 'Approved'");
    console.log('Successfully updated onboarding records to Approved:', res.rowCount);
  } catch (err) {
    console.error('Error updating onboarding:', err.message);
  } finally {
    await pool.end();
  }
}

approveAll();
