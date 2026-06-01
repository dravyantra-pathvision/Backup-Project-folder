const storage = require('../services/storageWrapper');

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function run(){
  const uid = 'default_user';
  const tripId = process.argv[2] || 'TRP-4403';
  console.log('Simulating updates for', tripId);

  // Ensure a baseline trip exists so updateTrip can operate when DB is unavailable
  try {
    const all = await storage.getAllTrips(uid);
    const existing = all.find(t => t.id === tripId);
    if (!existing) {
      const t0 = new Date().toISOString();
      await storage.createTrip(uid, { id: tripId, power: false, status: 'not_started', liveSpeed: 0, liveFuelCount: 100, _updatedAt: t0 });
      console.log('-> created baseline trip', tripId);
    }
  } catch(e) {
    console.error('Failed ensuring baseline trip', e && e.message);
  }

  // 1) ensure power on, moderate speed
  const t1 = new Date().toISOString();
  await storage.updateTrip(uid, tripId, { power: true, status: 'running', liveSpeed: 60, _updatedAt: t1 });
  console.log('-> set speed 60');

  // wait 1s
  await sleep(1200);

  // 2) increase speed above rash threshold -> expect rash_driving
  const t2 = new Date().toISOString();
  await storage.updateTrip(uid, tripId, { power: true, status: 'running', liveSpeed: 85, _updatedAt: t2 });
  console.log('-> increased speed to 85 (rash expected)');

  // wait 1s
  await sleep(1200);

  // 3) sudden drop to trigger harsh braking
  const t3 = new Date().toISOString();
  await storage.updateTrip(uid, tripId, { power: true, status: 'running', liveSpeed: 40, _updatedAt: t3 });
  console.log('-> dropped speed to 40 (harsh braking expected)');

  // wait and then set idle
  await sleep(1200);
  const t4 = new Date().toISOString();
  await storage.updateTrip(uid, tripId, { power: true, status: 'idle', _updatedAt: t4 });
  console.log('-> set status idle (idle alert expected)');

  console.log('Simulation complete. Check backend/data/alerts.json or frontend UI.');
}

run().catch(e=>{ console.error(e); process.exit(1); });
