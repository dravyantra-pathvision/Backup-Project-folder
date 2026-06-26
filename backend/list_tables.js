const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  port: process.env.PG_PORT,
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  console.log("Tables in database:");
  res.rows.forEach(row => console.log("- " + row.table_name));
  await client.end();
}

run().catch(console.error);
