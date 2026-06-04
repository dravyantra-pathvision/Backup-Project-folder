const { pool } = require('../config/dbconfig');
const detector = require('./fuelTheftDetector');

let pollIntervalId = null;
let snapshot = new Map();

async function fetchAllTrips() {
  const res = await pool.query('SELECT * FROM trips');
  return res.rows || [];
}

function rowKey(row) {
  try {
    // Stringify row to detect any change; order of keys from DB is stable
    return JSON.stringify(row);
  } catch (e) {
    return String(row.id || Math.random());
  }
}

async function pollOnce() {
  try {
    const rows = await fetchAllTrips();
    const seen = new Set();
    for (const r of rows) {
      const id = r.id || r.trip_id || r.tripid || null;
      if (!id) continue;
      seen.add(id);
      const key = rowKey(r);
      const prevKey = snapshot.get(id);
      if (!prevKey) {
        // new row - call detector with prev null
        try { await detector.checkAndAlert(null, r); } catch (e) { console.error('dbPoller detector error', e && e.message); }
      } else if (prevKey !== key) {
        // changed row - parse previous snapshot and call detector
        try {
          const prev = JSON.parse(prevKey);
          await detector.checkAndAlert(prev, r);
        } catch (e) {
          console.error('dbPoller failed comparing rows', e && e.message);
        }
      }
      snapshot.set(id, key);
    }
    // cleanup deleted rows from snapshot
    for (const existingId of Array.from(snapshot.keys())) {
      if (!seen.has(existingId)) snapshot.delete(existingId);
    }
  } catch (e) {
    // likely DB not reachable — log and continue; next tick will retry
    console.error('dbPoller error (DB may be unreachable):', e && e.message);
  }
}

function start(intervalMs = Number(process.env.DB_POLL_INTERVAL_MS) || 5000) {
  if (pollIntervalId) return;
  // Run immediately then at interval
  pollOnce();
  pollIntervalId = setInterval(pollOnce, intervalMs);
  console.log(`dbPoller: started polling every ${intervalMs}ms`);
}

function stop() {
  if (pollIntervalId) clearInterval(pollIntervalId);
  pollIntervalId = null;
  snapshot.clear();
}

module.exports = { start, stop };
