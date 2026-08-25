const { pool } = require('./config/dbconfig');
async function test() {
  try {
    const triggers = await pool.query("SELECT event_object_table, trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table IN ('vehicles', 'trips', 'telemetry_history')");
    console.log('Triggers:', triggers.rows);
  } catch(e) { console.error(e) }

  try {
    await pool.query('UPDATE vehicles SET lat = COALESCE($1, lat), lng = COALESCE($2, lng), speed = COALESCE($3, speed), fuel = COALESCE($4, fuel), is_active = $5, vibration = COALESCE($6, vibration), route = CASE WHEN $7 = TRUE AND $1 IS NOT NULL THEN route || $8::jsonb ELSE route END, updated_at = NOW() WHERE device_id = $9',
    [
      12.981598, 77.59501, 35, 33.75, true, 0.0, 77.59501, JSON.stringify([[12.981598, 77.59501]]), 'DEV-001'
    ]);
    console.log('Update worked with number for $7');
  } catch (e) { console.error('Update with number failed:', e.message); }

  try {
    await pool.query('UPDATE vehicles SET lat = COALESCE($1, lat), lng = COALESCE($2, lng), speed = COALESCE($3, speed), fuel = COALESCE($4, fuel), is_active = $5, vibration = COALESCE($6, vibration), route = CASE WHEN $7 = TRUE AND $1 IS NOT NULL THEN route || $8::jsonb ELSE route END, updated_at = NOW() WHERE device_id = $9',
    [
      12.981598, 77.59501, 35, 33.75, true, 0.0, true, JSON.stringify([[12.981598, 77.59501]]), 'DEV-001'
    ]);
    console.log('Update worked with true for $7');
  } catch (e) { console.error('Update with true failed:', e.message); }

  process.exit();
}
test();
