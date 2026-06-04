const { pool } = require('./config/dbconfig');

(async () => {
  try {
    const result = await pool.query(
      "SELECT prosrc FROM pg_proc WHERE proname = 'compute_idle_money_wasted'"
    );
    console.log('Trigger function source:\n');
    console.log(result.rows[0].prosrc);
    await pool.end();
  } catch(e) { 
    console.error(e.message); 
    process.exit(1); 
  }
})();
