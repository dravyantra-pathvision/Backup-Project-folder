(async ()=>{
  try{
    const payload = {
      id: 'TEST-ASSIGN-1',
      vehicle: 'KA01AB1234',
      driver: 'Driver One',
      status: 'running',
      power: true,
      _updatedAt: new Date().toISOString()
    };
    const res = await fetch('http://localhost:3000/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Status', res.status);
    const text = await res.text();
    console.log('Response:', text);
  }catch(e){
    console.error('Error', e && e.message);
  }
})();
