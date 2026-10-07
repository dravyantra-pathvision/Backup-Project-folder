const { pool } = require('../config/dbconfig');

async function runMigration() {
  console.log('Dropping insurance, permit, puc and related unused columns from vehicles table...');
  try {
    await pool.query(`
      ALTER TABLE vehicles 
      DROP COLUMN IF EXISTS insurance,
      DROP COLUMN IF EXISTS permit,
      DROP COLUMN IF EXISTS puc,
      DROP COLUMN IF EXISTS insurance_url,
      DROP COLUMN IF EXISTS puc_url,
      DROP COLUMN IF EXISTS insurance_expiry,
      DROP COLUMN IF EXISTS puc_expiry;
    `);
    console.log('Successfully dropped columns.');

    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles'
      ORDER BY ordinal_position;
    `);
    console.log('Current vehicles table columns:');
    res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
