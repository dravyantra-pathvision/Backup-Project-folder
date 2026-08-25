// scripts/check_bytea.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const res = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND (data_type LIKE '%bytea%' OR data_type LIKE '%blob%' OR data_type LIKE '%binary%')
  `);
  console.log('BINARY COLUMNS IN DB:', res.rows);
  process.exit(0);
}

main();
