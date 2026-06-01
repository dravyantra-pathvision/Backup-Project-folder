const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'trips.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]));
}

function readAll() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function writeAll(arr) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(arr, null, 2));
}

const defaultsFor = (data) => ({
  id: data.id || (`local-${Date.now()}`),
  uid: data.uid || 'default_user',
  vehicle: data.vehicle || null,
  driver: data.driver || null,
  status: data.status || 'not_started',
  idleDuration: typeof data.idleDuration === 'number' ? data.idleDuration : Number(data.idle_duration || 0),
  liveIdleTime: data.liveIdleTime || data.live_idle_time || '00:00:00',
  liveFuelCount: typeof data.liveFuelCount === 'number' ? data.liveFuelCount : Number(data.live_fuel_count || 0),
  // keep a few common fields so UI can render
  load: data.load || null,
  client: data.client || null,
  date: data.date || new Date().toISOString().slice(0,10),
  progress: typeof data.progress === 'number' ? data.progress : 0,
  distance: typeof data.distance === 'number' ? data.distance : 0,
  fuelUsed: typeof data.fuelUsed === 'number' ? data.fuelUsed : 0,
  tripCompleted: !!data.tripCompleted
});

module.exports = {
  init: () => ensure(),
  getAllTrips: async (uid) => {
    const all = readAll();
    return all.filter(t => t.uid === uid && t.tripCompleted !== true && t.status !== 'completed');
  },
  createTrip: async (uid, data) => {
    const all = readAll();
    const obj = Object.assign(defaultsFor(data), { uid });
    const exists = all.findIndex(t => t.id === obj.id);
    if (exists >= 0) {
      all[exists] = Object.assign(all[exists], obj);
    } else {
      all.push(obj);
    }
    writeAll(all);
    return obj;
  },
  updateTrip: async (uid, id, data) => {
    const all = readAll();
    const idx = all.findIndex(t => t.id === id && t.uid === uid);
    if (idx === -1) return null;
    const prev = all[idx];
    const merged = Object.assign({}, prev, data);
    // keep id/uid consistent
    merged.id = prev.id;
    merged.uid = prev.uid;
    all[idx] = merged;
    writeAll(all);
    return merged;
  },
  deleteTrip: async (uid, id) => {
    const all = readAll();
    const idx = all.findIndex(t => t.id === id && t.uid === uid);
    if (idx === -1) return null;
    const removed = all.splice(idx,1)[0];
    writeAll(all);
    return removed;
  }
};
