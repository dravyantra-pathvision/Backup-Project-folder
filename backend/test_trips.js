const { pool } = require('./config/dbconfig');
async function test() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'trips'");
    console.log(res.rows.map(r => r.column_name).join(', '));
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
test();
