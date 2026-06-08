const { pool } = require('./config/dbconfig');

(async () => {
  try {
    const r = await pool.query('SELECT SUM(total_idle_time) AS total_idle_time_sum, SUM(idle_money_wasted) AS idle_money_wasted_sum, COUNT(*) AS count FROM trips');
    console.log(JSON.stringify(r.rows[0]));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
