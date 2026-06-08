const { pool } = require('../config/dbconfig');

async function show() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, trip_id, operation, changed_at, actor, old_row, new_row FROM trip_audit ORDER BY changed_at DESC LIMIT 20');
    console.log('trip_audit rows (most recent first):');
    for (const r of res.rows) {
      console.log('---');
      console.log('id=', r.id, 'trip=', r.trip_id, 'op=', r.operation, 'at=', r.changed_at, 'actor=', r.actor);
      console.log('old:', JSON.stringify(r.old_row));
      console.log('new:', JSON.stringify(r.new_row));
    }
  } catch (e) {
    console.error('Failed to read trip_audit:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (require.main === module) show();

module.exports = { show };
