// scripts/find_primary_keys.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const tables = ['drivers', 'vehicles', 'trips', 'users', 'fleet_onboarding', 'report_history'];
  for (const table of tables) {
    try {
      const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.key_column_usage 
        WHERE table_name = $1;
      `, [table]);
      console.log(`Table ${table} Primary Key / Unique columns:`, res.rows.map(r => r.column_name));
    } catch (e) {
      console.error(table, e.message);
    }
  }
  process.exit(0);
}

main();
