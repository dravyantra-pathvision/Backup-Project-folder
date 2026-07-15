// migrations/run_migration.js
// Run this once on the server to apply the fleet analytics schema migration.
// Usage: node migrations/run_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

async function run() {
  const sqlFile = path.join(__dirname, '001_fleet_analytics.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('=== DravYantra Fleet Analytics Migration ===');
  console.log('Connecting to database...');

  const client = await pool.connect();
  try {
    console.log('Running migration...');
    await client.query(sql);
    console.log('\n✅ Migration 001_fleet_analytics.sql completed successfully!\n');
    console.log('Tables created/modified:');
    console.log('  • trips           — added 16 new columns');
    console.log('  • alerts          — added lifecycle columns');
    console.log('  • fleet_settings  — added 14 new threshold columns');
    console.log('  • devices         — added 6 health monitoring columns');
    console.log('  • vehicle_lifetime_stats (NEW)');
    console.log('  • telemetry_history (NEW)');
    console.log('  • fuel_refill_events (NEW)');
    console.log('  • fuel_theft_events (NEW)');
  } catch (e) {
    console.error('\n❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
