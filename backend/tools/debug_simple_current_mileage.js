const { pool } = require('../config/dbconfig');
(async () => {
  try {
    const sql = `UPDATE trips SET current_mileage = $1 WHERE id = $2 AND uid = $3 RETURNING current_mileage`;
    const params = [2.0, 'TRP-4404', 'default_user'];
    const res = await pool.query(sql, params);
    console.log('rows:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
