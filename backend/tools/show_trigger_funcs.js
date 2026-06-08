const { pool } = require('../config/dbconfig');
(async () => {
  try {
    const funcs = await pool.query(
      `SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition
       FROM pg_proc p
       WHERE proname IN ('compute_idle_money_wasted','recalc_speeding_fuel_wasted','trips_status_trigger','notify_trip_update','trips_audit_func')`);
    console.log(JSON.stringify(funcs.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
