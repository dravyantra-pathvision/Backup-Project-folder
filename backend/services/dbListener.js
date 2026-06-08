require('dotenv').config();
const { Client } = require('pg');
const detector = require('./fuelTheftDetector');

let listenerClient = null;

function createClient() {
  return process.env.DATABASE_URL
    ? new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Client({
        user: process.env.PG_USER || 'postgres',
        host: process.env.PG_HOST || 'localhost',
        database: process.env.PG_DATABASE || 'dravyantra',
        password: process.env.PG_PASSWORD || 'postgres',
        port: process.env.PG_PORT || 5432,
      });
}

async function start() {
  try {
    listenerClient = createClient();
    await listenerClient.connect();
    await listenerClient.query('LISTEN trip_updates');
    listenerClient.on('notification', async (msg) => {
      try {
        const payload = JSON.parse(msg.payload || '{}');
        const prev = payload.old || null;
        const updated = payload.new || null;
        // Call detector with prev and updated
        try { await detector.checkAndAlert(prev, updated); } catch (e) { console.error('detector error from DB listener', e && e.message); }
      } catch (e) {
        console.error('Failed parsing trip_updates payload', e && e.message);
      }
    });
    console.log('DBListener: listening for trip_updates notifications');
  } catch (e) {
    console.error('DBListener failed to start:', e && e.message);
    if (listenerClient) {
      try { await listenerClient.end(); } catch (closeErr) {}
    }
  }
}

async function stop() {
  if (listenerClient) {
    try { await listenerClient.query('UNLISTEN trip_updates'); } catch (e) {}
    try { await listenerClient.end(); } catch (e) {}
    listenerClient = null;
  }
}

module.exports = { start, stop };
