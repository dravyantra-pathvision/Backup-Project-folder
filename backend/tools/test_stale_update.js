const http = require('http');
const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/trips');
    const list = await res.json();
    const t = list.find(x => x.id === 'TRP-4406') || list[0];
    if (!t) return console.error('No trip found to test');
    console.log('Found trip id', t.id, 'current idleDuration', t.idleDuration);

    // First do a fresh update (no timestamp) to set DB updated_at to now
    const fresh = { ...t, idleDuration: (t.idleDuration || 0) + 1 };
    await fetch('http://localhost:3000/api/trips/' + encodeURIComponent(t.id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fresh)
    });

    // Inspect DB updated_at directly for debugging
    try {
      const { pool } = require('../config/dbconfig');
      const r = await pool.query('SELECT updated_at FROM trips WHERE id = $1', [t.id]);
      console.log('DB updated_at after fresh update:', r.rows[0] && r.rows[0].updated_at);
    } catch (e) {
      console.log('Could not query DB updated_at:', e.message);
    }

    // Now attempt a stale update using an old timestamp (1 hour ago)
    const staleTs = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const payload = { ...t, idleDuration: (t.idleDuration || 0) + 2, _updatedAt: staleTs };

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/trips/' + encodeURIComponent(t.id),
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };

    const req = http.request(options, (res2) => {
      let d = '';
      res2.on('data', (c) => d += c);
      res2.on('end', () => {
        console.log('PUT status', res2.statusCode, 'body', d);
      });
    });
    req.on('error', (e) => console.error('req err', e.message));
    req.write(JSON.stringify(payload));
    req.end();
  } catch (e) {
    console.error('test error', e.message);
  }
})();
