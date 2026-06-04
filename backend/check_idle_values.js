const { pool } = require('./config/dbconfig');

(async () => {
  try {
    // Check if idle_money_wasted column exists and has data
    const result = await pool.query(`
      SELECT id, total_idle_time, idle_money_wasted, fuel_used 
      FROM trips 
      WHERE idle_money_wasted > 0 
      ORDER BY idle_money_wasted DESC 
      LIMIT 5
    `);
    console.log('Trips with idle_money_wasted > 0:');
    console.table(result.rows);
    
    // Sum total
    const sum = await pool.query('SELECT SUM(idle_money_wasted) as total FROM trips');
    console.log('\nTotal idle_money_wasted from trips:', sum.rows[0]);
    
    // Check all trips count
    const count = await pool.query('SELECT COUNT(*) as cnt FROM trips');
    console.log('Total trips:', count.rows[0]);
    
    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
