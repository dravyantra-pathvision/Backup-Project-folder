// scripts/find_url_columns.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function main() {
  const { rows } = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND data_type IN ('text', 'character varying')
    ORDER BY table_name, column_name;
  `);

  console.log('--- ALL VARCHAR/TEXT COLUMNS IN DATABASE ---');
  const tableMap = {};
  for (const { table_name, column_name } of rows) {
    if (!tableMap[table_name]) tableMap[table_name] = [];
    tableMap[table_name].push(column_name);
  }
  
  for (const [table, cols] of Object.entries(tableMap)) {
    console.log(`Table: ${table} -> Cols: ${cols.join(', ')}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
