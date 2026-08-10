// scripts/remove_super_admin_restriction.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  console.log('🔄 Setting requires_super_admin = false for all settings in PostgreSQL...');
  const res = await pool.query('UPDATE system_settings SET requires_super_admin = false');
  console.log(`✅ Successfully updated ${res.rowCount} settings in system_settings table!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error updating system_settings:', err);
  process.exit(1);
});
