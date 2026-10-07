const { pool } = require('./config/dbconfig');

async function checkCols() {
  const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicles' ORDER BY ordinal_position");
  console.log('VEHICLES COLUMNS:', r.rows.map(c => c.column_name));
  process.exit(0);
}

checkCols().catch(err => {
  console.error(err);
  process.exit(1);
});
