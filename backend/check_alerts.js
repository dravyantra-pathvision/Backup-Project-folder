const { pool } = require('./config/dbconfig');
pool.query("SELECT id, message, type, severity, detected_at FROM alerts WHERE type='compliance' ORDER BY detected_at DESC")
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit());
