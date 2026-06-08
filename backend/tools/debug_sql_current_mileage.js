const { pool } = require('../config/dbconfig');
(async () => {
  try {
    const sql = `UPDATE trips SET current_mileage = COALESCE($1, current_mileage), fuel_saved = COALESCE($2, fuel_saved), fuel_wasted = COALESCE($3, fuel_wasted), money_saved = COALESCE($4, money_saved), money_wasted = COALESCE($5, money_wasted), total_idle_time = COALESCE($6, total_idle_time), idle_money_wasted = COALESCE($7, idle_money_wasted), speeding_fuel_wasted = COALESCE($8, speeding_fuel_wasted) WHERE id = $9 AND uid = $10 RETURNING *`;
    const params = [2.0, 5.74, 0.05, 574, 5, 3, 5.1, 0.0, 'TRP-4404', 'default_user'];
    const res = await pool.query(sql, params);
    console.log('rows:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
