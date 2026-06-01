const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/trips');
    const list = await res.json();
    const t = list.find(x => x.id === 'TRP-4406') || list[0];
    if (!t) return console.error('No trip found');
    console.log('Before: id', t.id, 'liveSpeed', t.liveSpeed);

    const payload = { liveSpeed: 42 };
    const resp = await fetch('http://localhost:3000/api/trips/' + encodeURIComponent(t.id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const body = await resp.json();
    console.log('PUT status', resp.status, 'body liveSpeed', body.liveSpeed);

    const res2 = await fetch('http://localhost:3000/api/trips');
    const list2 = await res2.json();
    const after = list2.find(x => x.id === t.id);
    console.log('After GET: liveSpeed', after.liveSpeed);
  } catch (e) { console.error(e.message); }
})();
