const { pool } = require('../config/dbconfig');
(async ()=>{
  const client = await pool.connect();
  try{
    const cols = ['w1','w2','w3','w4','w5','w6'];
    const res = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='trips' AND column_name = ANY($1)`, [cols]);
    if(res.rows.length===0){
      console.log('No legacy w1..w6 columns found.');
      return process.exit(0);
    }
    console.log('Found columns:', res.rows.map(r=>r.column_name));
    const d = new Date();
    const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
    const backupName = `trips_backup_${ts}`;
    console.log('Creating backup table', backupName);
    await client.query(`CREATE TABLE ${backupName} AS TABLE trips;`);
    console.log('Backup created. Dropping legacy columns...');
    await client.query(`ALTER TABLE trips DROP COLUMN IF EXISTS w1, DROP COLUMN IF EXISTS w2, DROP COLUMN IF EXISTS w3, DROP COLUMN IF EXISTS w4, DROP COLUMN IF EXISTS w5, DROP COLUMN IF EXISTS w6;`);
    const after = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='trips' AND column_name = ANY($1)`, [cols]);
    console.log('Remaining w-columns after alteration:', after.rows.map(r=>r.column_name));
  }catch(e){
    console.error('ERR', e && (e.stack||e.message));
    process.exit(2);
  }finally{
    client.release();
    process.exit(0);
  }
})();
