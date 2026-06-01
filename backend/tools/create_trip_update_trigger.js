const { pool } = require('../config/dbconfig');

async function createTrigger() {
  const client = await pool.connect();
  try {
    const sql = `
    CREATE OR REPLACE FUNCTION notify_trip_update() RETURNS trigger AS $$
    DECLARE
      payload JSON;
    BEGIN
      payload = json_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW));
      PERFORM pg_notify('trip_updates', payload::text);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_notify_trip_update ON trips;
    CREATE TRIGGER trg_notify_trip_update
      AFTER INSERT OR UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION notify_trip_update();
    `;
    await client.query(sql);
    console.log('Trip update trigger created or replaced');
  } catch (e) {
    console.error('Failed to create trip update trigger:', e && e.message);
  } finally {
    client.release();
  }
}

if (require.main === module) {
  createTrigger().then(()=>process.exit(0)).catch(()=>process.exit(1));
}

module.exports = { createTrigger };
