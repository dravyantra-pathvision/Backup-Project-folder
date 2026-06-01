const fetch = require('node-fetch');

(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/trips');
    const list = await res.json();
    const t = list.find(x => x.id === 'TRP-4406') || list[0];
    if (!t) return console.error('No trip found');
    console.log('Before: id', t.id, 'distance', t.distance, 'idleDuration', t.idleDuration);

    // Send a partial update (only idleDuration)
    const payload = { idleDuration: (t.idleDuration || 0) + 10 };
    const resp = await fetch('http://localhost:3000/api/trips/' + encodeURIComponent(t.id), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const body = await resp.json();
    console.log('PUT status', resp.status, 'body idleDuration', body.idleDuration);

    const res2 = await fetch('http://localhost:3000/api/trips');
    const list2 = await res2.json();
    const after = list2.find(x => x.id === t.id);
    console.log('After: distance', after.distance, 'idleDuration', after.idleDuration);
  } catch (e) { console.error(e.message); }
})();
