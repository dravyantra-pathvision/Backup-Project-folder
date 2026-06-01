const { pool } = require('../config/dbconfig');
const detector = require('./fuelTheftDetector');

let listenerClient = null;

async function start() {
  try {
    listenerClient = await pool.connect();
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
    if (listenerClient) listenerClient.release();
  }
}

async function stop() {
  if (listenerClient) {
    try { await listenerClient.query('UNLISTEN trip_updates'); } catch (e) {}
    listenerClient.release();
    listenerClient = null;
  }
}

module.exports = { start, stop };
