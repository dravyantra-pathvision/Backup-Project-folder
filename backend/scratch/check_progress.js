// scratch/check_progress.js
const { pool } = require('../config/dbconfig');

async function checkProgress() {
  const res = await pool.query(`
    SELECT id, vehicle, driver, from_location, to_location, distance, progress, status, trip_completed, live_speed
    FROM trips 
    WHERE uid = 'FpeQcZrgtjP0bBoPco7fbxm1SDA2'
  `);
  console.log('=== CURRENT TRIP PROGRESS ===');
  console.table(res.rows);
  process.exit(0);
}

checkProgress();
