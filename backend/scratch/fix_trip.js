require('dotenv').config({path: '../.env'});
const { pool } = require('../config/dbconfig');

async function main() {
  try {
    const res = await pool.query("UPDATE trips SET status='Not Started' WHERE status ILIKE 'halted'");
    console.log('Trips updated:', res.rowCount);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
