require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function resetTrips() {
  const client = await pool.connect();
  try {
    console.log("Resetting trips not started...");
    await client.query(`
      UPDATE trips 
      SET fuel_used = 0, idle_duration = 0, distance = 0, score = 0, delay_minutes = 0, toll_count = 0 
      WHERE status = 'not started' OR status = 'Not Started'
    `);
    console.log("Trips reset!");
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}
resetTrips();
