require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function getRecords() {
  const email = 'guruhugar0310@gmail.com';
  try {
    const userRes = await pool.query('SELECT uid FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      console.log('User not found');
      return;
    }
    const uid = userRes.rows[0].uid;
    console.log('UID:', uid);

    const driversRes = await pool.query('SELECT * FROM drivers WHERE uid = $1 AND name IN ($2, $3, $4)', [uid, 'Anand', 'Kartik', 'Chakravarthi']);
    console.log('Drivers:', driversRes.rows);

    const vehiclesRes = await pool.query('SELECT * FROM vehicles WHERE uid = $1', [uid]);
    console.log('Vehicles:', vehiclesRes.rows);

    const tripsRes = await pool.query('SELECT * FROM trips WHERE uid = $1', [uid]);
    console.log('Trips:', tripsRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
getRecords();
