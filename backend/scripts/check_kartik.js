// scripts/check_kartik.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const res = await pool.query("SELECT id, name, image_url, aadhar_url, license_url FROM drivers");
  console.log('ALL DRIVERS IN DB:');
  for (const r of res.rows) {
    console.log(`ID: ${r.id} | Name: ${r.name}`);
    console.log(`  image_url:   ${r.image_url}`);
    console.log(`  aadhar_url:  ${r.aadhar_url}`);
    console.log(`  license_url: ${r.license_url}\n`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
