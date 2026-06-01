const http = require('http');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:3000/api/trips';
const FILE = path.join(__dirname, '..', 'data', 'trips.json');

http.get(URL, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const arr = JSON.parse(d);
      const normalized = (Array.isArray(arr)?arr: (arr.value||arr)).map(t => ({
        id: t.id,
        uid: t.uid || 'default_user',
        vehicle: t.vehicle,
        driver: t.driver,
        status: t.status,
        idleDuration: typeof t.idleDuration === 'number' ? t.idleDuration : Number(t.idle_duration || 0),
        liveIdleTime: t.liveIdleTime || t.live_idle_time || '00:00:00',
        liveFuelCount: typeof t.liveFuelCount === 'number' ? t.liveFuelCount : Number(t.live_fuel_count || 0),
        // legacy w1..w6 removed
        // include other fields for UI compatibility
        load: t.load,
        client: t.client,
        date: t.date,
        progress: t.progress,
        distance: t.distance,
        fuelUsed: t.fuelUsed,
        tripCompleted: t.tripCompleted || false
      }));
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(normalized, null, 2));
      console.log('seeded', normalized.length, 'trips to', FILE);
    } catch (e) {
      console.error('parse error', e && e.message);
    }
  });
}).on('error', e => console.error('req err', e.message));
