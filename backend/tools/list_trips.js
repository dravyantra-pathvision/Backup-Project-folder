const { pool } = require('../config/dbconfig');

(async () => {
  try {
    const res = await pool.query("SELECT id, status, idle_duration, live_speed, power FROM trips ORDER BY id LIMIT 50");
    console.log('Trips:');
    res.rows.forEach(r => console.log(r));
    process.exit(0);
  } catch (e) {
    console.error('Error querying trips:', e);
    process.exit(1);
  }
})();
