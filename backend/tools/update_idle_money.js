const { pool } = require('../config/dbconfig');

// Conversion: 60 minutes idle => 100 rupees
const RUPEES_PER_MINUTE = 100 / 60.0;

async function ensureColumn() {
  await pool.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS idle_money_wasted DOUBLE PRECISION DEFAULT 0.0;`);
}

async function updateIdleMoney() {
  await ensureColumn();
  const res = await pool.query('SELECT id, total_idle_time, money_wasted FROM trips');
  let totalRows = 0;
  let totalIdleMinutes = 0;
  let totalIdleRupees = 0;

  for (const r of res.rows) {
    const id = r.id;
    const mins = Number(r.total_idle_time || 0);
    const idleR = Number((mins * RUPEES_PER_MINUTE).toFixed(2));
    // Update the new idle_money_wasted column. Do not modify existing money_wasted to avoid double-counting.
    await pool.query('UPDATE trips SET idle_money_wasted = $1 WHERE id = $2', [idleR, id]);
    totalRows += 1;
    totalIdleMinutes += mins;
    totalIdleRupees += idleR;
  }

  console.log(`Updated ${totalRows} trips`);
  console.log(`Total idle minutes: ${totalIdleMinutes}`);
  console.log(`Total idle rupees: ${totalIdleRupees.toFixed(2)}`);
  return { totalRows, totalIdleMinutes, totalIdleRupees };
}

if (require.main === module) {
  updateIdleMoney()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error updating idle money:', err);
      process.exit(1);
    });
}

module.exports = { updateIdleMoney };
