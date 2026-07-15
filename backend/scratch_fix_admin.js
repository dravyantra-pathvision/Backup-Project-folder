require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function fixUser() {
  const adminUid = 'sSMA02ERr2VVsLCnUgG9SwTdfF93';
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM users WHERE uid = $1', [adminUid]);
    if (res.rows.length === 0) {
      console.log('Admin UID not found in users table. Inserting...');
      await client.query(`
        INSERT INTO users (uid, email, full_name, role)
        VALUES ($1, 'superadmin@dravyantra.com', 'Super Admin', 'admin')
      `, [adminUid]);
      console.log('Inserted.');
    } else {
      console.log('Admin UID exists.');
    }
    
    // Also let's check for DEV-003 and manually delete it if the user wants it deleted,
    // wait, the user said they are trying to delete it but it's not deleting.
    // In the frontend, the button is "Retire Device". Let's check what happens if I drop the FK.
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}
fixUser();
