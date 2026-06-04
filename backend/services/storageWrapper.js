const tripService = require('./tripService');
const localStore = require('./localTripStore');
const detector = require('./fuelTheftDetector');
const fs = require('fs');
const path = require('path');
const LOCAL_FILE = path.join(__dirname, '..', 'data', 'trips.json');

async function tryCall(fnName, ...args) {
  // Default behavior: prefer DB-backed `tripService`. Use local JSON store only
  // when explicitly forced via environment variable `FORCE_LOCAL=true`.
  const forceLocal = String(process.env.FORCE_LOCAL || '').toLowerCase() === 'true';
  if (forceLocal) {
    if (localStore && typeof localStore[fnName] === 'function') {
      try {
        let prev = null;
        if (fnName === 'updateTrip') {
          const all = await localStore.getAllTrips(args[0]);
          prev = all.find(t => t.id === args[1]);
        }
        console.log('storageWrapper: FORCE_LOCAL active — using localStore for', fnName);
        const res = await localStore[fnName](...args);
        if (fnName === 'updateTrip' || fnName === 'createTrip') {
          try { detector.checkAndAlert(prev, res); } catch(e){ console.error('detector error', e && e.message); }
        }
        return res;
      } catch(e){ console.error('localStore error', e && e.message); }
    }
  }
  try {
    // attempt to call tripService implementation
    if (tripService && typeof tripService[fnName] === 'function') {
      // if updateTrip, try to fetch previous via tripService.getAllTrips() if available
      let prev = null;
      if (fnName === 'updateTrip') {
        try {
          if (typeof tripService.getAllTrips === 'function') {
            const all = await tripService.getAllTrips(args[0]);
            prev = all.find(t => t.id === args[1]);
          }
        } catch (e) { /* ignore */ }
      }
      const result = await tripService[fnName](...args);
      // run theft detector with previous if found
      if (fnName === 'updateTrip' || fnName === 'createTrip') {
        try { detector.checkAndAlert(prev, result); } catch (e) { console.error('detector error', e && e.message); }
      }
      return result;
    }
  } catch (e) {
    console.error(`Primary DB call ${fnName} failed, falling back to local store:`, e && (e.message || e));
  }
  // fallback to local store if primary fails or if local store is the only option
  if (localStore && typeof localStore[fnName] === 'function') {
    try {
      const all = await localStore.getAllTrips(args[0]);
      const prev = all.find(t => t.id === args[1]);
      console.log('storageWrapper: falling back to localStore for', fnName);
      const result = await localStore[fnName](...args);
      if (fnName === 'updateTrip' || fnName === 'createTrip') {
        try { detector.checkAndAlert(prev, result); } catch (e) { console.error('detector error', e && e.message); }
      }
      return result;
    } catch (e) { console.error('localStore fallback error', e && e.message); }
  }
  throw new Error('No storage available');
}

module.exports = {
  getAllTrips: (...a)=> tryCall('getAllTrips', ...a),
  createTrip: (...a)=> tryCall('createTrip', ...a),
  updateTrip: (...a)=> tryCall('updateTrip', ...a),
  deleteTrip: (...a)=> tryCall('deleteTrip', ...a),
  getSummary: (...a)=> tryCall('getSummary', ...a)
};
