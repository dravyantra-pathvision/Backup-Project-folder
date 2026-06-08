const fs = require('fs');
const path = require('path');
const { readFleetSettings } = require('./fleetSettingsStore');

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

const getMileageFromLiveSpeed = (liveSpeed) => {
  const speed = Number(liveSpeed);
  if (!Number.isFinite(speed)) return 0.0;
  if (speed >= 40 && speed < 60) return 4.38;
  if (speed < 70) return 3.5;
  if (speed < 80) return 3.15;
  if (speed < 90) return 2.98;
  if (speed < 100) return 2.8;
  if (speed < 110) return 2.63;
  if (speed < 120) return 2.45;
  return 2.28;
};

const recalculateTripValues = (trip) => {
  const distance = Number(trip.distance || 0);
  const liveSpeed = Number(trip.liveSpeed || trip.live_speed || 0);
  const hasExplicitCurrentMileage = trip.currentMileage !== undefined || trip.current_mileage !== undefined;
  const prevFuelCount = Number(trip._prevLiveFuelCount ?? trip.prevLiveFuelCount ?? trip.prev_live_fuel_count ?? trip.liveFuelCount ?? trip.live_fuel_count ?? 0);
  const currentFuelCount = Number(trip.liveFuelCount || trip.live_fuel_count || 0);
  const theftThreshold = (() => {
    const settings = readFleetSettings();
    const configured = Number(settings && settings.fuelDropThreshold);
    return Number.isFinite(configured) && configured > 0 ? configured : 0.7;
  })();
  const currentMileage = hasExplicitCurrentMileage
    ? Number((trip.currentMileage ?? trip.current_mileage) || 0)
    : (liveSpeed > 0 ? getMileageFromLiveSpeed(liveSpeed) : Number(trip.currentMileage || trip.current_mileage || 0));
  const fuelUsed = (distance > 0 && currentMileage > 0) ? Number((distance / currentMileage).toFixed(2)) : Number(trip.fuelUsed || trip.fuel_used || 0);
  const defaultMileage = 3.5;
  const expectedFuel = distance > 0 ? Number((distance / defaultMileage).toFixed(2)) : 0;
  const fuelSaved = Math.max(0, expectedFuel - fuelUsed);
  const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);
  const theftDrop = Math.max(prevFuelCount - currentFuelCount, 0);
  const theftFuelLoss = theftDrop >= theftThreshold ? Number(theftDrop.toFixed(2)) : Number(trip.theftFuelLoss || trip.theft_fuel_loss || 0);
  const speedingFuelWasted = (distance > 0 && currentMileage > 0 && currentMileage < defaultMileage)
    ? Number(Math.max((distance / currentMileage) - (distance / defaultMileage), 0).toFixed(2))
    : 0.0;
  return {
    ...trip,
    manual_override: hasExplicitCurrentMileage ? true : trip.manual_override,
    currentMileage,
    fuelUsed,
    fuelSaved,
    fuelWasted: fuelWastedMileage,
    speedingFuelWasted,
    theftFuelLoss,
    theftMoneyLoss: Number((theftFuelLoss * 100).toFixed(2)),
  };
};

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
    const obj = recalculateTripValues(Object.assign(defaultsFor(data), { uid, _prevLiveFuelCount: 0 }));
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
    const merged = recalculateTripValues(Object.assign({}, prev, { _prevLiveFuelCount: Number(prev.liveFuelCount || prev.live_fuel_count || 0) }, data));
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
