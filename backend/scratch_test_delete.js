require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function testDelete() {
  const deviceId = 'DEV-003';
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(
      `UPDATE vehicles SET device_id = NULL WHERE device_id = $1`,
      [deviceId]
    );
    
    await client.query(
      `DELETE FROM devices WHERE device_id = $1 RETURNING *`,
      [deviceId]
    );

    await client.query('ROLLBACK'); 
    console.log('Delete Test successful');
  } catch (err) {
    console.error('Delete Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}
testDelete();
