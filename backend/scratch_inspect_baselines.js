require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function run() {
  const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicle_baselines' ORDER BY ordinal_position");
  console.log("=== vehicle_baselines columns ===");
  console.log(cols.rows);

  const rows = await pool.query("SELECT * FROM vehicle_baselines");
  console.log("\n=== vehicle_baselines existing records ===");
  console.log(rows.rows);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
