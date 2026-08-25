// scripts/replace_all_domains.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const s3Prefix = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/`;

  const targets = [
    { table: 'drivers', cols: ['image_url', 'aadhar_url', 'license_url'] },
    { table: 'vehicles', cols: ['rc_url', 'insurance_url', 'puc_url'] },
    { table: 'trips', cols: ['eway_bill_url'] },
    { table: 'users', cols: ['profile_photo'] },
    { table: 'fleet_onboarding', cols: ['company_logo'] },
    { table: 'report_history', cols: ['file_url'] },
  ];

  let totalUpdated = 0;

  for (const { table, cols } of targets) {
    for (const col of cols) {
      // Regex replace any http(s)://domain/uploads/ or /uploads/ with s3Prefix
      const q = `
        UPDATE "${table}"
        SET "${col}" = REGEXP_REPLACE("${col}", '^https?://[^/]+/uploads/', '${s3Prefix}')
        WHERE "${col}" LIKE '%/uploads/%'
      `;
      const res = await pool.query(q);
      if (res.rowCount > 0) {
        console.log(`Updated ${res.rowCount} rows in ${table}.${col}`);
        totalUpdated += res.rowCount;
      }
    }
  }

  console.log(`✅ All database image/document URLs converted to S3! Total updated: ${totalUpdated}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
