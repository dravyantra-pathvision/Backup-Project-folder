// scripts/verify_s3_migration.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const targets = [
    { table: 'drivers', cols: ['image_url', 'aadhar_url', 'license_url'] },
    { table: 'vehicles', cols: ['rc_url', 'insurance_url', 'puc_url'] },
    { table: 'trips', cols: ['eway_bill_url'] },
    { table: 'users', cols: ['profile_photo'] },
    { table: 'fleet_onboarding', cols: ['company_logo'] },
    { table: 'report_history', cols: ['file_url'] },
  ];

  console.log('=== S3 MIGRATION VERIFICATION REPORT ===\n');

  for (const { table, cols } of targets) {
    for (const col of cols) {
      try {
        const total = await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE "${col}" IS NOT NULL AND "${col}" != ''`);
        const s3Count = await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE "${col}" LIKE 'https://%.amazonaws.com/%'`);
        const legacyCount = await pool.query(`SELECT COUNT(*) FROM "${table}" WHERE "${col}" LIKE '%/uploads/%'`);

        console.log(`${table}.${col}: Total=${total.rows[0].count} | S3 URLs=${s3Count.rows[0].count} | Legacy URLs=${legacyCount.rows[0].count}`);
      } catch (e) {
        // Table or col not present
      }
    }
  }

  process.exit(0);
}

main();
