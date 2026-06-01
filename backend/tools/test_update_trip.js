const http = require('http');
const data = JSON.stringify({ idleDuration: 5, liveIdleTime: '00:00:05' });
const opts = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/trips/TRP-4406',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    console.log('PUT response:', d);
    http.get('http://localhost:3000/api/trips', (r) => {
      let b = '';
      r.on('data', (c) => b += c);
      r.on('end', () => {
        try {
          const parsed = JSON.parse(b);
          const arr = Array.isArray(parsed) ? parsed : (parsed.value || parsed);
          const t = arr.find(x => x.id === 'TRP-4406');
          console.log('After GET:', JSON.stringify({ id: t && t.id, idleDuration: t && t.idleDuration, liveIdleTime: t && t.liveIdleTime }));
        } catch (e) {
          console.error('err', e.message);
        }
      });
    }).on('error', e => console.error('get err', e.message));
  });
});

req.on('error', (e) => {
  console.error('req err', e.message);
});
req.write(data);
req.end();
