const { pool } = require('./config/dbconfig');

async function promoteAdmin() {
  try {
    const email = 'guruhugar6777@gmail.com';
    const res = await pool.query(
      `UPDATE users SET role = 'admin' WHERE email = $1 RETURNING *`,
      [email]
    );
    if (res.rows.length > 0) {
      console.log('✅ Successfully promoted user to admin:', res.rows[0]);
    } else {
      console.log('❌ User not found with email:', email);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    pool.end();
  }
}

promoteAdmin();
