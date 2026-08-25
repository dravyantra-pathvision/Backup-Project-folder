// scratch/check_db_triggers.js
const { pool } = require('../config/dbconfig');

async function checkTriggers() {
  const res = await pool.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'trips';
  `);
  console.log('=== TRIGGERS ON TRIPS ===');
  console.table(res.rows);

  const funcRes = await pool.query(`
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_name IN ('compute_idle_money_wasted', 'compute_trip_metrics', 'notify_trip_update');
  `);
  console.log('=== FUNCTIONS ON TRIPS ===');
  for (const r of funcRes.rows) {
    console.log(`--- Function: ${r.routine_name} ---`);
    console.log(r.routine_definition);
  }

  process.exit(0);
}

checkTriggers();
