const { pool } = require('../config/dbconfig');

async function createAudit() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_audit (
        id SERIAL PRIMARY KEY,
        trip_id TEXT,
        changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        operation TEXT,
        actor TEXT,
        old_row JSONB,
        new_row JSONB
      );

      CREATE OR REPLACE FUNCTION trips_audit_func() RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          INSERT INTO trip_audit(trip_id, operation, actor, old_row, new_row)
          VALUES (NEW.id::text, TG_OP, current_user, row_to_json(OLD), row_to_json(NEW));
        ELSIF TG_OP = 'INSERT' THEN
          INSERT INTO trip_audit(trip_id, operation, actor, old_row, new_row)
          VALUES (NEW.id::text, TG_OP, current_user, NULL, row_to_json(NEW));
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO trip_audit(trip_id, operation, actor, old_row, new_row)
          VALUES (OLD.id::text, TG_OP, current_user, row_to_json(OLD), NULL);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trips_audit_trigger ON trips;
      CREATE TRIGGER trips_audit_trigger
      AFTER INSERT OR UPDATE OR DELETE ON trips
      FOR EACH ROW EXECUTE PROCEDURE trips_audit_func();
    `);
    console.log('trip_audit table and trigger ensured');
  } catch (e) {
    console.error('Failed to create trip_audit:', e && e.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

if (require.main === module) createAudit();

module.exports = { createAudit };
