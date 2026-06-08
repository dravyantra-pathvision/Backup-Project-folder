const tripService = require('../services/tripService');

async function run() {
  try {
    const uid = 'default_user';
    const id = 'TRP-AUTO-' + Date.now();
    const data = {
      id,
      vehicle: 'AP12TEST',
      driver: 'DRV-TEST-1',
      from: 'AutoCity',
      to: 'AutoTown',
      status: 'pending',
      date: new Date().toISOString(),
    };

    console.log('Creating trip', id);
    const created = await tripService.createTrip(uid, data);
    console.log('Created:', created || '(no result)');

    const all = await tripService.getAllTrips(uid);
    const found = all.find(t => t.id === id);
    console.log('Found in DB trips:', !!found);
    if (found) console.log(found);
  } catch (e) {
    console.error('Error creating trip:', e && e.message, e && e.stack);
    process.exitCode = 1;
  }
}

run();
