require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function check() {
  try {
    const devRes = await pool.query("SELECT uid, plate, device_id FROM vehicles WHERE device_id LIKE '%008%'");
    console.log("Vehicles 008:", devRes.rows);
  } catch(e) { console.error(e); } finally { pool.end(); }
}
check();
