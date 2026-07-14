const { pool } = require('./config/dbconfig');
pool.query("SELECT uid FROM users WHERE email='guruhugar6777@gmail.com'").then(res => {
  console.log(res.rows[0].uid);
  pool.end();
});
