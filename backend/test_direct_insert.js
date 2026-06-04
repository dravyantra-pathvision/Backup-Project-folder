const { pool } = require('./config/dbconfig');

(async () => {
  try {
    const id = 'TEST-FW-' + Date.now();
    console.log('Testing insert with ID:', id);
    
    const result = await pool.query(
      'INSERT INTO trips (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, distance, live_speed, current_mileage, fuel_used, idle_money_wasted, fuel_wasted, money_wasted',
      [id, 'test_fw_user', 350, 50, 100, 100]
    );
    
    console.log('\nTest Result:');
    console.log(JSON.stringify(result.rows[0], null, 2));
    
    // Expected:
    console.log('\nExpected:');
    console.log('  fuel_wasted: ~1.7 L (only idle, no mileage waste)');
    console.log('  money_wasted: ~170');
    
    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
