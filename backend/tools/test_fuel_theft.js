const storage = require('../services/storageWrapper');
const fs = require('fs');
const path = require('path');

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function run(){
  const uid = 'default_user';
  const id = 'TRP-4406';
  console.log('Setting previous fuel to 300.5');
  await storage.updateTrip(uid, id, { liveFuelCount: 300.5, _updatedAt: new Date().toISOString() });
  await sleep(1000);
  console.log('Dropping to 298 to simulate theft');
  await storage.updateTrip(uid, id, { liveFuelCount: 298, _updatedAt: new Date().toISOString() });
  await sleep(500);
  const alertsFile = path.join(__dirname, '..', 'data', 'alerts.json');
  if (fs.existsSync(alertsFile)) {
    console.log('Alerts:');
    console.log(fs.readFileSync(alertsFile, 'utf8'));
  } else {
    console.log('No alerts file found');
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
