const storage = require('../services/storageWrapper');
const fs = require('fs');
const path = require('path');

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function run(){
  const uid = 'default_user';
  const id = 'TRP-4406';

  console.log('--- simulate rash driving: 70 -> 85 ---');
  await storage.updateTrip(uid, id, { liveSpeed: 70, _updatedAt: new Date().toISOString() });
  await sleep(300);
  await storage.updateTrip(uid, id, { liveSpeed: 85, _updatedAt: new Date().toISOString() });
  await sleep(300);

  console.log('--- simulate harsh braking: 85 -> 40 ---');
  await storage.updateTrip(uid, id, { liveSpeed: 85, _updatedAt: new Date().toISOString() });
  await sleep(200);
  await storage.updateTrip(uid, id, { liveSpeed: 40, _updatedAt: new Date().toISOString() });
  await sleep(300);

  console.log('--- simulate fuel theft: 300.5 -> 298 ---');
  await storage.updateTrip(uid, id, { liveFuelCount: 300.5, _updatedAt: new Date().toISOString() });
  await sleep(200);
  await storage.updateTrip(uid, id, { liveFuelCount: 298, _updatedAt: new Date().toISOString() });
  await sleep(300);

  console.log('--- simulate idle ---');
  await storage.updateTrip(uid, id, { status: 'running', _updatedAt: new Date().toISOString() });
  await sleep(200);
  await storage.updateTrip(uid, id, { status: 'idle', _updatedAt: new Date().toISOString() });

  const alertsFile = path.join(__dirname, '..', 'data', 'alerts.json');
  if (fs.existsSync(alertsFile)) {
    console.log('Alerts:');
    console.log(fs.readFileSync(alertsFile, 'utf8'));
  } else {
    console.log('No alerts file found');
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
