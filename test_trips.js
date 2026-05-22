const dotenv = require('dotenv');
dotenv.config({ path: 'backend/.env' });
const { pool } = require('./backend/db.js');

(async () => {
  try {
    const res = await pool.query('SELECT * FROM trips');
    console.log('Trips count:', res.rows.length);
    console.log('Trips:', res.rows);
  } catch (err) {
    console.error('Error querying trips:', err);
  } finally {
    await pool.end();
  }
})();
