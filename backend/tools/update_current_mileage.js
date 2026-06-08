const { pool } = require('../config/dbconfig');

const id = process.argv[2] || 'TRP-4404';
const newMil = Number(process.argv[3] || 2.0);

(async () => {
  try {
    const res = await pool.query('UPDATE trips SET current_mileage = $1 WHERE id = $2 RETURNING *', [newMil, id]);
    console.log('Updated rows:', res.rowCount);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await pool.end();
  }
})();
