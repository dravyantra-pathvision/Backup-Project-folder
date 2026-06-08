const { pool } = require('../config/dbconfig');

async function watch(intervalMs = 2000) {
  const client = await pool.connect();
  try {
    console.log('watching trip_audit for new rows...');
    let lastId = 0;
    while (true) {
      const res = await client.query(
        'SELECT id, trip_id, operation, changed_at, actor, old_row, new_row FROM trip_audit WHERE id > $1 ORDER BY id ASC',
        [lastId]
      );
      for (const r of res.rows) {
        console.log('---');
        console.log('id=', r.id, 'trip=', r.trip_id, 'op=', r.operation, 'at=', r.changed_at, 'actor=', r.actor);
        console.log('old:', JSON.stringify(r.old_row));
        console.log('new:', JSON.stringify(r.new_row));
        lastId = r.id;
      }
      await new Promise((res) => setTimeout(res, intervalMs));
    }
  } catch (e) {
    console.error('watch failed:', e && e.message);
    process.exit(1);
  } finally {
    try { client.release(); } catch (e) {}
  }
}

if (require.main === module) {
  const ms = process.env.WATCH_INTERVAL_MS ? Number(process.env.WATCH_INTERVAL_MS) : 2000;
  watch(ms);
}

module.exports = { watch };
