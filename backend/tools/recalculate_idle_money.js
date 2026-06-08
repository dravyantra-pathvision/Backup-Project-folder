// Recalculate idle_money_wasted = total_idle_time * 0.6
const { pool } = require('../config/dbconfig');

const recalculateIdleMoneyWasted = async () => {
  try {
    console.log('Starting idle_money_wasted recalculation...');
    
    const query = `
      UPDATE trips
      SET idle_money_wasted = total_idle_time * 1.7
      WHERE total_idle_time > 0;
    `;
    
    const result = await pool.query(query);
    console.log(`✓ Updated ${result.rowCount} rows`);
    console.log(`  Formula: idle_money_wasted = total_idle_time * 1.7`);
    
    // Show sample updated values
    const sampleQuery = `
      SELECT id, total_idle_time, idle_money_wasted 
      FROM trips 
      WHERE total_idle_time > 0 
      LIMIT 5;
    `;
    
    const samples = await pool.query(sampleQuery);
    console.log('\nSample updated values:');
    samples.rows.forEach(row => {
      console.log(`  Trip ${row.id}: idle_time=${row.total_idle_time}min → idle_money=${row.idle_money_wasted.toFixed(2)}₹`);
    });
    
    // Show new total
    const totalQuery = `
      SELECT 
        COUNT(*) as total_trips,
        SUM(total_idle_time) as total_idle_time,
        SUM(idle_money_wasted) as total_idle_money
      FROM trips;
    `;
    
    const totals = await pool.query(totalQuery);
    const row = totals.rows[0];
    console.log(`\nNew totals:`);
    console.log(`  Total trips: ${row.total_trips}`);
    console.log(`  Total idle time: ${row.total_idle_time ? Number(row.total_idle_time).toFixed(2) : 0} minutes`);
    console.log(`  Total idle money wasted: ₹${row.total_idle_money ? Number(row.total_idle_money).toFixed(2) : 0}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

recalculateIdleMoneyWasted();
