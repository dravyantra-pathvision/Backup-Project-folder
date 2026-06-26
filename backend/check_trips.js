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
  const res = await client.query('SELECT id, uid, from_location, to_location, vehicle, driver FROM trips');
  console.log(res.rows);
  await client.end();
}
run();
