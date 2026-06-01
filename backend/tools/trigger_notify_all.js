const fs = require('fs');
const http = require('http');

const HOST = process.env.BACKEND_HOST || 'localhost';
const PORT = Number(process.env.BACKEND_PORT) || 3000;
const tripsPath = require('path').join(__dirname, '..', 'data', 'trips.json');

function notifyTrip(tripId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path: `/api/trips/${encodeURIComponent(tripId)}/notify`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(tripsPath)) {
    console.error('trips.json not found at', tripsPath);
    process.exit(2);
  }
  const trips = JSON.parse(fs.readFileSync(tripsPath, 'utf8'));
  const ids = trips.map(t => t.id).filter(Boolean);
  console.log(`Found ${ids.length} trips, notifying each...`);
  for (const id of ids) {
    try {
      const r = await notifyTrip(id);
      console.log(`Notified ${id}: ${r.status}`);
    } catch (e) {
      console.error(`Failed notify ${id}:`, e && e.message);
    }
  }
}

main();
