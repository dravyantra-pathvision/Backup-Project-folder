const { pool } = require('../config/dbconfig');
(async () => {
  try {
    const res = await pool.query(
      `SELECT tgname, tgtype, tgfoid, pg_get_triggerdef(oid) AS definition
       FROM pg_trigger
       WHERE tgrelid = 'trips'::regclass AND NOT tgisinternal;`
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
