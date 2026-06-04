const { pool } = require('../config/dbconfig');
(async () => {
  try {
    const res = await pool.query("SELECT id, current_mileage, default_mileage, speeding_fuel_wasted, distance, fuel_used FROM trips WHERE id='TRP-4404'");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
