const { pool } = require('../config/dbconfig');
(async ()=>{
  try{
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='trips' ORDER BY ordinal_position");
    console.log('trip columns:', res.rows.map(r=>r.column_name).join(', '));
  }catch(e){
    console.error('ERR', e && (e.stack||e.message));
  }finally{
    pool.end();
  }
})();
