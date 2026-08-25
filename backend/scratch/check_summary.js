// scratch/check_summary.js
const { pool } = require('../config/dbconfig');
const tripService = require('../services/tripService');

async function checkSummary() {
  const uid = 'FpeQcZrgtjP0bBoPco7fbxm1SDA2';
  const summary = await tripService.getSummary(uid);
  console.log('=== TRIP SUMMARY FOR FLEET OWNER ===');
  console.log(summary);

  const tripsRes = await pool.query(`SELECT id, vehicle, distance, fuel_used, fuel_wasted, money_wasted, total_idle_time, idle_money_wasted FROM trips WHERE uid = $1`, [uid]);
  console.log('=== TRIPS IN DB FOR OWNER ===');
  console.table(tripsRes.rows);

  process.exit(0);
}

checkSummary();
