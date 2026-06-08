const { pool } = require('./config/dbconfig');

(async () => {
  try {
    console.log('Cleaning up old test trips...');
    await pool.query("DELETE FROM trips WHERE id LIKE 'TRP-FW-%'");
    console.log('✅ Cleanup complete\n');
    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
