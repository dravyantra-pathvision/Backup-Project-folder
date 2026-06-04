const { pool } = require('./config/dbconfig');

(async () => {
  try {
    const t = await pool.query("SELECT tgname, tgtype, tgfoid FROM pg_trigger WHERE tgrelid = 'trips'::regclass AND NOT tgisinternal;");
    console.log('triggers', JSON.stringify(t.rows, null, 2));
    const f = await pool.query("SELECT proname, prosrc FROM pg_proc WHERE proname='compute_idle_money_wasted';");
    console.log('func', JSON.stringify(f.rows, null, 2));
    await pool.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
