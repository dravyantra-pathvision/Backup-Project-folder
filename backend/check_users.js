const { pool } = require('./config/dbconfig');
pool.query("SELECT * FROM users WHERE email = 'guruhugar6777@gmail.com'")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit(0));
