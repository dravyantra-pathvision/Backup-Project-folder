const { pool } = require('./config/dbconfig');

async function updateRole() {
  try {
    const res = await pool.query("UPDATE users SET role = 'admin' WHERE email = 'guruhugar6777@gmail.com'");
    console.log('Update result:', res.rowCount, 'rows updated.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

updateRole();
