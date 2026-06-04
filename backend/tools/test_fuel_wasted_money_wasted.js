const { pool } = require('../config/dbconfig');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runTests() {
  try {
    // Use timestamp to make trip IDs unique
    const ts = Date.now();
    
    // Ensure test user exists
    await pool.query(`
      INSERT INTO users (uid, email, full_name)
      VALUES ('test_fw_user', 'test_fw@example.com', 'Test FW User')
      ON CONFLICT (uid) DO NOTHING
    `);

    console.log('✅ Test User Created\n');

    // Test 1: Low speed (40-59 km/h) + Idle Time
    // At 50 km/h, current_mileage = 4.38 km/l (good efficiency, > 3.5 baseline)
    console.log('=== Test 1: Low Speed (50 km/h, 4.38 km/l) + Idle Time ===');
    const trip1 = await pool.query(`
      INSERT INTO trips 
      (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter)
      VALUES 
      ($1, 'test_fw_user', 350, 50, 100, 100)
      RETURNING 
        id, distance, current_mileage, fuel_used, 
        fuel_wasted, money_wasted, total_idle_time, 
        idle_money_wasted, fuel_price_per_liter
    `, [`TRP-FW-1-${ts}`]);
    const t1 = trip1.rows[0];
    
    // Expected:
    // Current mileage at 50 km/h = 4.38 km/l (trigger calculation)
    // baseline_fuel = 350 / 3.5 = 100 L
    // actual_fuel = 350 / 4.38 = 79.91 L
    // mileage_fuel_wasted = 0 (because 4.38 > 3.5, good efficiency)
    // idle_money_wasted = 100 * 1.7 = 170 rupees
    // idle_fuel_wasted = 170 / 100 = 1.7 L
    // fuel_wasted = 0 + 1.7 = 1.7 L
    // money_wasted = 1.7 * 100 = 170 rupees
    
    console.log('Actual Results:');
    console.log(`  Distance: ${t1.distance} km`);
    console.log(`  Current Mileage: ${t1.current_mileage} km/l (from 50 km/h)`);
    console.log(`  Fuel Used: ${t1.fuel_used} L`);
    console.log(`  Total Idle Time: ${t1.total_idle_time} min`);
    console.log(`  Idle Money Wasted: ₹${t1.idle_money_wasted}`);
    console.log(`  Fuel Wasted: ${t1.fuel_wasted} L (mileage + idle)`);
    console.log(`  Money Wasted: ₹${t1.money_wasted}`);
    console.log(`  Fuel Price: ₹${t1.fuel_price_per_liter}/L`);
    
    const expectedFuelWasted1 = 1.7;
    const expectedMoneyWasted1 = 170;
    
    const fuelWastedOk1 = Math.abs(t1.fuel_wasted - expectedFuelWasted1) < 0.1;
    const moneyWastedOk1 = Math.abs(t1.money_wasted - expectedMoneyWasted1) < 5;
    
    console.log('\nExpected:');
    console.log(`  Fuel Wasted: ~${expectedFuelWasted1} L (only idle, no mileage waste)`);
    console.log(`  Money Wasted: ~₹${expectedMoneyWasted1}`);
    console.log(`Status: ${fuelWastedOk1 && moneyWastedOk1 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 2: High Speed (100 km/h) + Idle Time (poor efficiency)
    // At 100 km/h, current_mileage = 2.8 km/l (poor efficiency, < 3.5 baseline)
    console.log('=== Test 2: High Speed (100 km/h, 2.8 km/l) + Idle Time ===');
    const trip2 = await pool.query(`
      INSERT INTO trips 
      (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter)
      VALUES 
      ($1, 'test_fw_user', 350, 100, 50, 100)
      RETURNING 
        id, distance, current_mileage, fuel_used, 
        fuel_wasted, money_wasted, total_idle_time, 
        idle_money_wasted, fuel_price_per_liter
    `, [`TRP-FW-2-${ts}`]);
    const t2 = trip2.rows[0];
    
    // Expected:
    // Current mileage at 100 km/h = 2.63 km/l (from trigger: speed < 110 → 2.63)
    // baseline_fuel = 350 / 3.5 = 100 L
    // actual_fuel = 350 / 2.63 = 133.08 L
    // mileage_fuel_wasted = 133.08 - 100 = 33.08 L (because 2.63 < 3.5, poor efficiency)
    // idle_money_wasted = 50 * 1.7 = 85 rupees
    // idle_fuel_wasted = 85 / 100 = 0.85 L
    // fuel_wasted = 33.08 + 0.85 = 33.93 L
    // money_wasted = 33.93 * 100 = 3393 rupees
    
    console.log('Actual Results:');
    console.log(`  Distance: ${t2.distance} km`);
    console.log(`  Current Mileage: ${t2.current_mileage} km/l (from 100 km/h)`);
    console.log(`  Fuel Used: ${t2.fuel_used} L`);
    console.log(`  Total Idle Time: ${t2.total_idle_time} min`);
    console.log(`  Idle Money Wasted: ₹${t2.idle_money_wasted}`);
    console.log(`  Fuel Wasted: ${t2.fuel_wasted} L (mileage + idle)`);
    console.log(`  Money Wasted: ₹${t2.money_wasted}`);
    
    const expectedFuelWasted2 = 33.93;
    const expectedMoneyWasted2 = 3393;
    
    const fuelWastedOk2 = Math.abs(t2.fuel_wasted - expectedFuelWasted2) < 0.2;
    const moneyWastedOk2 = Math.abs(t2.money_wasted - expectedMoneyWasted2) < 10;
    
    console.log('\nExpected:');
    console.log(`  Fuel Wasted: ~${expectedFuelWasted2} L (mileage + idle waste)`);
    console.log(`  Money Wasted: ~₹${expectedMoneyWasted2}`);
    console.log(`Status: ${fuelWastedOk2 && moneyWastedOk2 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 3: Same High Speed (100 km/h) with Different Fuel Price (₹150/L)
    console.log('=== Test 3: High Speed (100 km/h) with Different Fuel Price (₹150/L) ===');
    const trip3 = await pool.query(`
      INSERT INTO trips 
      (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter)
      VALUES 
      ($1, 'test_fw_user', 350, 100, 100, 150)
      RETURNING 
        id, distance, current_mileage, fuel_used, 
        fuel_wasted, money_wasted, total_idle_time, 
        idle_money_wasted, fuel_price_per_liter
    `, [`TRP-FW-3-${ts}`]);
    const t3 = trip3.rows[0];
    
    // Expected:
    // Current mileage at 100 km/h = 2.63 km/l
    // baseline_fuel = 350 / 3.5 = 100 L
    // actual_fuel = 350 / 2.63 = 133.08 L
    // mileage_fuel_wasted = 133.08 - 100 = 33.08 L
    // idle_money_wasted = 100 * 1.7 = 170 rupees
    // idle_fuel_wasted = 170 / 150 = 1.13 L
    // fuel_wasted = 33.08 + 1.13 = 34.21 L
    // money_wasted = 34.21 * 150 = 5131.5 rupees
    
    console.log('Actual Results:');
    console.log(`  Fuel Wasted: ${t3.fuel_wasted} L`);
    console.log(`  Money Wasted: ₹${t3.money_wasted}`);
    console.log(`  Fuel Price: ₹${t3.fuel_price_per_liter}/L`);
    
    const expectedFuelWasted3 = 34.21;
    const expectedMoneyWasted3 = 5131.5;
    
    const fuelWastedOk3 = Math.abs(t3.fuel_wasted - expectedFuelWasted3) < 0.2;
    const moneyWastedOk3 = Math.abs(t3.money_wasted - expectedMoneyWasted3) < 20;
    
    console.log('\nExpected:');
    console.log(`  Fuel Wasted: ~${expectedFuelWasted3} L`);
    console.log(`  Money Wasted: ~₹${expectedMoneyWasted3}`);
    console.log(`Status: ${fuelWastedOk3 && moneyWastedOk3 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 4: Excellent Mileage (low speed 40 km/h) - No Idle
    console.log('=== Test 4: Excellent Mileage (40 km/h, 4.38 km/l) + No Idle ===');
    const trip4 = await pool.query(`
      INSERT INTO trips 
      (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter)
      VALUES 
      ($1, 'test_fw_user', 350, 40, 0, 100)
      RETURNING 
        id, distance, current_mileage, fuel_used, 
        fuel_wasted, money_wasted, total_idle_time, 
        idle_money_wasted, fuel_price_per_liter
    `, [`TRP-FW-4-${ts}`]);
    const t4 = trip4.rows[0];
    
    // Expected:
    // Current mileage at 40 km/h = 4.38 km/l
    // baseline_fuel = 350 / 3.5 = 100 L
    // actual_fuel = 350 / 4.38 = 79.91 L
    // mileage_fuel_wasted = 0 (because 4.38 > 3.5, good efficiency)
    // idle_fuel_wasted = 0 (no idle time)
    // fuel_wasted = 0
    // money_wasted = 0
    
    console.log('Actual Results:');
    console.log(`  Current Mileage: ${t4.current_mileage} km/l`);
    console.log(`  Fuel Used: ${t4.fuel_used} L`);
    console.log(`  Fuel Wasted: ${t4.fuel_wasted} L`);
    console.log(`  Money Wasted: ₹${t4.money_wasted}`);
    
    const fuelWastedOk4 = t4.fuel_wasted === 0;
    const moneyWastedOk4 = t4.money_wasted === 0;
    
    console.log('\nExpected:');
    console.log(`  Fuel Wasted: 0 L`);
    console.log(`  Money Wasted: ₹0`);
    console.log(`Status: ${fuelWastedOk4 && moneyWastedOk4 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 5: Update Trip - Change Distance (with high speed 100 km/h)
    console.log('=== Test 5: Update Trip - Change Distance (350→700 km) at 100 km/h ===');
    
    const trip5Initial = await pool.query(`
      INSERT INTO trips 
      (id, uid, distance, live_speed, total_idle_time, fuel_price_per_liter)
      VALUES 
      ($1, 'test_fw_user', 350, 100, 100, 100)
      RETURNING id, distance, fuel_wasted, money_wasted
    `, [`TRP-FW-5-${ts}`]);
    const t5Before = trip5Initial.rows[0];
    console.log('Before Update:');
    console.log(`  Distance: ${t5Before.distance} km`);
    console.log(`  Fuel Wasted: ${t5Before.fuel_wasted} L`);
    console.log(`  Money Wasted: ₹${t5Before.money_wasted}`);
    
    await delay(100);
    
    const trip5Updated = await pool.query(`
      UPDATE trips 
      SET distance = 700 
      WHERE id = $1 AND uid = 'test_fw_user'
      RETURNING id, distance, fuel_wasted, money_wasted
    `, [`TRP-FW-5-${ts}`]);
    const t5After = trip5Updated.rows[0];
    console.log('\nAfter Update (distance 700 km):');
    console.log(`  Distance: ${t5After.distance} km`);
    console.log(`  Fuel Wasted: ${t5After.fuel_wasted} L`);
    console.log(`  Money Wasted: ₹${t5After.money_wasted}`);
    
    // Expected after update (at 100 km/h, current_mileage = 2.63 km/l):
    // baseline_fuel = 700 / 3.5 = 200 L
    // actual_fuel = 700 / 2.63 = 266.16 L
    // mileage_fuel_wasted = 266.16 - 200 = 66.16 L
    // idle_fuel_wasted = 170 / 100 = 1.7 L (same idle time)
    // fuel_wasted = 66.16 + 1.7 = 67.86 L
    // money_wasted = 67.86 * 100 = 6786 rupees
    
    const expectedFuelWasted5 = 67.86;
    const expectedMoneyWasted5 = 6786;
    
    const fuelWastedOk5 = Math.abs(t5After.fuel_wasted - expectedFuelWasted5) < 0.2;
    const moneyWastedOk5 = Math.abs(t5After.money_wasted - expectedMoneyWasted5) < 20;
    
    console.log('\nExpected after update:');
    console.log(`  Fuel Wasted: ~${expectedFuelWasted5} L`);
    console.log(`  Money Wasted: ~₹${expectedMoneyWasted5}`);
    console.log(`Status: ${fuelWastedOk5 && moneyWastedOk5 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Summary
    console.log('=== SUMMARY ===');
    const allPass = [fuelWastedOk1, moneyWastedOk1, fuelWastedOk2, moneyWastedOk2, 
                     fuelWastedOk3, moneyWastedOk3, fuelWastedOk4, moneyWastedOk4,
                     fuelWastedOk5, moneyWastedOk5].every(x => x);
    
    if (allPass) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Some tests failed');
    }

    await pool.end();
    process.exit(allPass ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

runTests();
