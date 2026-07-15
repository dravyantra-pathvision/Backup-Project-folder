const { pool } = require('./config/dbconfig');
async function run() {
    const tables = ['alerts', 'drivers', 'devices', 'fuel_logs'];
    for (const t of tables) {
        const r = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
        console.log(`\n=== ${t} ===`);
        r.rows.forEach(row => console.log(`  ${row.column_name}: ${row.data_type}`));
    }
    pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
