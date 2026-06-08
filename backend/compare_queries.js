const { pool } = require('./config/dbconfig');

(async () => {
  try {
    // Simulate the getSummary function with the fix
    const uid = 'user123'; // Use the uid from existing trips
    
    // First, find a valid uid
    const uidResult = await pool.query('SELECT DISTINCT uid FROM trips LIMIT 1');
    if (uidResult.rows.length === 0) {
      console.log('No trips found');
      process.exit(0);
    }
    
    const validUid = uidResult.rows[0].uid;
    console.log('Testing with uid:', validUid);
    
    // OLD query (what was being used)
    const oldQuery = `
      SELECT COALESCE(SUM(fuel_used),0)::double precision AS total_fuel_used, 
             COALESCE(SUM(fuel_wasted),0)::double precision AS total_fuel_wasted, 
             COALESCE(SUM(fuel_saved),0)::double precision AS total_fuel_saved, 
             COALESCE(SUM(money_wasted),0)::double precision AS total_money_wasted, 
             COALESCE(SUM(money_saved),0)::double precision AS total_money_saved, 
             COALESCE(SUM(total_idle_time),0)::double precision AS total_idle_minutes, 
             COALESCE(SUM(COALESCE(total_idle_time,0) * 1.7),0)::double precision AS total_idle_rupees 
      FROM trips 
      WHERE uid = $1
    `;
    
    // NEW query (fixed)
    const newQuery = `
      SELECT COALESCE(SUM(fuel_used),0)::double precision AS total_fuel_used, 
             COALESCE(SUM(fuel_wasted),0)::double precision AS total_fuel_wasted, 
             COALESCE(SUM(fuel_saved),0)::double precision AS total_fuel_saved, 
             COALESCE(SUM(money_wasted),0)::double precision AS total_money_wasted, 
             COALESCE(SUM(money_saved),0)::double precision AS total_money_saved, 
             COALESCE(SUM(total_idle_time),0)::double precision AS total_idle_minutes, 
             COALESCE(SUM(idle_money_wasted),0)::double precision AS total_idle_rupees 
      FROM trips 
      WHERE uid = $1
    `;
    
    console.log('\n=== OLD QUERY (recalculating from total_idle_time * 1.7) ===');
    const oldResult = await pool.query(oldQuery, [validUid]);
    console.log(oldResult.rows[0]);
    
    console.log('\n=== NEW QUERY (summing idle_money_wasted directly) ===');
    const newResult = await pool.query(newQuery, [validUid]);
    console.log(newResult.rows[0]);
    
    console.log('\nDifference:', newResult.rows[0].total_idle_rupees - oldResult.rows[0].total_idle_rupees);
    
    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
