const { pool } = require('./config/dbconfig');

(async () => {
  try {
    // Check if trigger exists
    const triggers = await pool.query(
      "SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'trips'"
    );
    console.log('Triggers on trips table:', triggers.rows);

    // Check columns
    const cols = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trips' AND column_name IN ('fuel_wasted', 'money_wasted', 'idle_money_wasted')"
    );
    console.log('Fuel-related columns:', cols.rows);

    // Check if function exists
    const funcs = await pool.query(
      "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'compute_idle_money_wasted'"
    );
    console.log('Functions:', funcs.rows);

    // Try a sample query to see trigger in action
    const result = await pool.query(
      "SELECT id, distance, live_speed, current_mileage, fuel_used, idle_money_wasted, fuel_wasted, money_wasted FROM trips LIMIT 1"
    );
    console.log('\nSample trip data:');
    console.log(result.rows[0]);

    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
