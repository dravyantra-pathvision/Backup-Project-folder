const { pool } = require('./config/dbconfig');
async function test() {
  const query = `INSERT INTO telemetry_history
       (device_id, vehicle_plate, trip_id, uid,
        lat, lng, speed, fuel_level, engine_on, vibration, heading, rpm,
        heartbeat, raw_timestamp, received_at, is_valid, validation_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15,$16)`;
     
  try {
    await pool.query(query, [
      'DEV-001', 'KA-01-AA-1111', 'T-1', null,
      12.9, 77.5, 35, 33.75, true, 0.0, 0, 0, null, new Date(), true, null
    ]);
    console.log('Insert history worked with null');
  } catch (e) { console.error('History null failed:', e.message); }

  try {
    await pool.query(query, [
      'DEV-001', 'KA-01-AA-1111', 'T-1', undefined,
      12.9, 77.5, 35, 33.75, true, 0.0, 0, 0, null, new Date(), true, null
    ]);
    console.log('Insert history worked with undefined');
  } catch (e) { console.error('History undefined failed:', e.message); }

  process.exit();
}
test();
