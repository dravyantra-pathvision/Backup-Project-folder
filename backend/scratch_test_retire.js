require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function testRetire() {
  const deviceId = 'DEV-003';
  const status = 'Retired';
  const adminUid = 'sSMA02ERr2VVsLCnUgG9SwTdfF93'; // from .env SUPER_ADMIN_UIDS
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const res = await client.query(
      `UPDATE devices SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE device_id = $2 RETURNING *`,
      [status, deviceId]
    );
    
    if (res.rows.length === 0) {
      console.log('Device not found');
    } else {
      console.log('Updated device:', res.rows[0]);
    }

    await client.query(
      `INSERT INTO device_audit_logs (device_id, admin_uid, action, remarks)
       VALUES ($1, $2, 'Status Changed', $3)`,
      [deviceId, adminUid, `Status changed to ${status}`]
    );

    await client.query('ROLLBACK'); // rollback so we don't permanently change it just testing
    console.log('Test successful');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}
testRetire();
