const { pool } = require('../config/dbconfig');
(async ()=>{
  try{
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='trips' AND column_name IN ('live_fuel_count')");
    console.log('FOUND', res.rows.map(r=>r.column_name));
  }catch(e){
    console.error('ERR', e && (e.stack||e.message));
  }finally{
    pool.end();
  }
})();
