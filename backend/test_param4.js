const { pool } = require('./config/dbconfig');
async function test() {
  const query = `UPDATE vehicles SET lat = COALESCE($1, lat), lng = COALESCE($2, lng), speed = COALESCE($3, speed), fuel = COALESCE($4, fuel), is_active = $5, vibration = COALESCE($6, vibration), route = CASE WHEN $7 = TRUE AND $1 IS NOT NULL THEN route || $8::jsonb ELSE route END, updated_at = NOW() WHERE device_id = $9`;
  
  // Test undefined for fuel
  try {
    await pool.query(query, [ 12.98, 77.59, 35, undefined, true, 0.0, true, JSON.stringify([[12.9, 77.5]]), 'DEV-001' ]);
    console.log('Update worked with undefined');
  } catch (e) { console.error('Error with undefined:', e.message); }

  // Test null for fuel
  try {
    await pool.query(query, [ 12.98, 77.59, 35, null, true, 0.0, true, JSON.stringify([[12.9, 77.5]]), 'DEV-001' ]);
    console.log('Update worked with null');
  } catch (e) { console.error('Error with null:', e.message); }

  // Test string for fuel
  try {
    await pool.query(query, [ 12.98, 77.59, 35, "33.75", true, 0.0, true, JSON.stringify([[12.9, 77.5]]), 'DEV-001' ]);
    console.log('Update worked with string');
  } catch (e) { console.error('Error with string:', e.message); }

  // Test float for fuel but missing lat
  try {
    await pool.query(query, [ null, null, null, null, true, 0.0, true, JSON.stringify([]), 'DEV-001' ]);
    console.log('Update worked with all nulls');
  } catch (e) { console.error('Error with all nulls:', e.message); }

  process.exit();
}
test();
