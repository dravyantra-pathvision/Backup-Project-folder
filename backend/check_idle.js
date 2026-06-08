const { pool } = require('./config/dbconfig');

(async () => {
  try {
    console.log('\n=== Individual Trip Idle Times ===\n');
    const res = await pool.query(`
      SELECT id, status, idle_duration, live_idle_time 
      FROM trips 
      WHERE trip_completed IS NOT TRUE
      ORDER BY id 
      LIMIT 10
    `);
    
    if (res.rows.length === 0) {
      console.log('No trips found');
    } else {
      res.rows.forEach(r => {
        console.log(`Trip: ${r.id.substring(0, 12)}`);
        console.log(`  Status: ${r.status}`);
        console.log(`  idle_duration: ${r.idle_duration}m`);
        console.log(`  live_idle_time: ${r.live_idle_time}`);
        
        // Parse live_idle_time to seconds if HH:MM:SS format
        let idleMinutes = r.idle_duration || 0;
        if (r.live_idle_time && r.live_idle_time.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
          const [h, m, s] = r.live_idle_time.split(':').map(Number);
          const totalSeconds = (h * 3600) + (m * 60) + s;
          idleMinutes = Math.round(totalSeconds / 60);
          console.log(`  (parsed from HH:MM:SS: ${idleMinutes}m)`);
        }
        console.log('');
      });
    }

    console.log('=== Total Idle Calculation (from live_idle_time in minutes) ===\n');
    const summaryRes = await pool.query(`
      SELECT 
        COUNT(*) as trip_count,
        SUM(idle_duration) as total_idle_minutes,
        COALESCE(SUM(CASE 
          WHEN live_idle_time ~ '^\\d{1,2}:\\d{2}:\\d{2}$' 
          THEN ROUND(((split_part(live_idle_time,':',1)::int*3600) + (split_part(live_idle_time,':',2)::int*60) + split_part(live_idle_time,':',3)::int) / 60.0)
          ELSE idle_duration
        END),0) as total_idle_minutes_effective
      FROM trips
      WHERE trip_completed IS NOT TRUE
    `);
    
    const row = summaryRes.rows[0];
    console.log(`Total trips: ${row.trip_count}`);
    console.log(`Sum of idle_duration (stored): ${row.total_idle_minutes}m`);
    console.log(`Total idle time (from live_idle_time): ${row.total_idle_minutes_effective}m`);
    
    // Calculate: 60 minutes = ₹100, so multiply minutes by (100/60)
    const rupees = row.total_idle_minutes_effective * (100 / 60);
    
    console.log(`\nCalculation (using live_idle_time in minutes):`);
    console.log(`  ${row.total_idle_minutes_effective} minutes × (₹100 / 60 minutes) = ₹${rupees.toFixed(2)}`);
    
    await pool.end();
    process.exit(0);
  } catch(e) { 
    console.error('Error:', e.message);
    process.exit(1); 
  }
})();
