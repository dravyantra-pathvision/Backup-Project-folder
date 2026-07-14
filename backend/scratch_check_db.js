const { pool } = require('./config/dbconfig');

(async () => {
  try {
    const tripRes = await pool.query('SELECT * FROM trips ORDER BY created_at DESC LIMIT 1');
    console.log('--- LATEST TRIP ---');
    console.log(tripRes.rows[0] ? tripRes.rows[0] : 'No trips found');

    const updateRes = await pool.query('SELECT * FROM trip_updates ORDER BY timestamp DESC LIMIT 1');
    console.log('\n--- LATEST TRIP UPDATE ---');
    console.log(updateRes.rows[0] ? updateRes.rows[0] : 'No trip updates found');
  } catch (e) {
    console.error('Error querying DB:', e);
  } finally {
    await pool.end();
  }
})();
