const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'trips.json');
(async()=>{
  try{
    if(!fs.existsSync(FILE)) { console.log('no file'); return; }
    const txt = fs.readFileSync(FILE,'utf8')||'[]';
    const arr = JSON.parse(txt);
    const cleaned = arr.map(o=>{ ['w1','w2','w3','w4','w5','w6'].forEach(k=>{ if(Object.prototype.hasOwnProperty.call(o,k)) delete o[k]; }); return o; });
    fs.writeFileSync(FILE, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log('cleaned', cleaned.length);
  }catch(e){ console.error(e && e.message); }
})();
