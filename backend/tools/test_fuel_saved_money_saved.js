// Test suite for Fuel Saved and Money Saved calculations
// Based on 3.5 km/l baseline with automatic calculation on mileage/distance/fuel_price changes

const { pool, initDB } = require('../config/dbconfig');
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (msg, color = 'reset') => {
  console.log(`${colors[color]}${msg}${colors.reset}`);
};

const TEST_UID = 'test-user-' + Date.now();
const TEST_VEHICLE = 'TEST-TRUCK-001';

// Test 1: Fuel Saved when current_mileage > 3.5 km/l
const testFuelSavedBetterEfficiency = async () => {
  log('\n=== Test 1: Fuel Saved (Better Efficiency - 50 km/h) ===', 'blue');
  
  try {
    // Setup: Create user
    await pool.query(
      `INSERT INTO users (uid, email, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uid) DO NOTHING`,
      [TEST_UID, `${TEST_UID}@test.com`, 'Test User', 'fleet_owner']
    );

    // Create trip at 50 km/h (current_mileage = 4.38 km/l, better than baseline 3.5)
    // Distance: 350 km
    // Fuel Price: ₹100/l
    const tripId = 'fuel-saved-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 350, 50, 100, 'running']
    );

    const result = await pool.query(
      `SELECT distance, live_speed, current_mileage, fuel_used, fuel_saved, money_saved, fuel_price_per_liter 
       FROM trips WHERE id = $1`,
      [tripId]
    );

    const row = result.rows[0];
    if (!row) {
      log('✗ Trip not found', 'red');
      return false;
    }

    log(`Trip Data:`, 'yellow');
    log(`  Distance: ${row.distance} km`, 'yellow');
    log(`  Live Speed: ${row.live_speed} km/h`, 'yellow');
    log(`  Current Mileage: ${row.current_mileage} km/l`, 'yellow');
    log(`  Fuel Used: ${row.fuel_used} liters`, 'yellow');
    log(`  Fuel Price: ₹${row.fuel_price_per_liter}/l`, 'yellow');

    // Expected calculations:
    // Baseline: 350 / 3.5 = 100 L
    // Actual: 350 / 4.38 = 79.91 L
    // Fuel Saved: 100 - 79.91 = 20.09 L
    // Money Saved: 20.09 × 100 = ₹2009
    const expectedBaselineFuel = 100;
    const expectedActualFuel = 79.91;
    const expectedFuelSaved = 20.09;
    const expectedMoneySaved = 2009;

    log(`\nExpected Calculations:`, 'cyan');
    log(`  Baseline (3.5 km/l): 350 / 3.5 = ${expectedBaselineFuel} L`, 'cyan');
    log(`  Actual (${row.current_mileage} km/l): 350 / ${row.current_mileage} = ${expectedActualFuel.toFixed(2)} L`, 'cyan');
    log(`  Fuel Saved: ${expectedBaselineFuel} - ${expectedActualFuel.toFixed(2)} = ${expectedFuelSaved.toFixed(2)} L`, 'cyan');
    log(`  Money Saved: ${expectedFuelSaved.toFixed(2)} × 100 = ₹${expectedMoneySaved.toFixed(0)}`, 'cyan');

    log(`\nActual Values:`, 'yellow');
    log(`  Fuel Saved: ${row.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row.money_saved}`, 'yellow');

    // Check if calculations are correct (within 0.1 tolerance for floating point)
    const fuelSavedCorrect = Math.abs(row.fuel_saved - expectedFuelSaved) < 0.1;
    const moneySavedCorrect = Math.abs(row.money_saved - expectedMoneySaved) < 10;

    if (fuelSavedCorrect && moneySavedCorrect) {
      log('✓ Test 1 PASSED: Fuel saved and money saved calculated correctly', 'green');
      return true;
    } else {
      log('✗ Test 1 FAILED: Values do not match expected', 'red');
      if (!fuelSavedCorrect) log(`  Fuel Saved mismatch: ${row.fuel_saved} vs ${expectedFuelSaved.toFixed(2)}`, 'red');
      if (!moneySavedCorrect) log(`  Money Saved mismatch: ${row.money_saved} vs ${expectedMoneySaved.toFixed(0)}`, 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Test 2: Fuel Saved = 0 when current_mileage <= 3.5 km/l (worse efficiency)
const testFuelSavedWorseEfficiency = async () => {
  log('\n=== Test 2: Fuel Saved = 0 (Worse Efficiency - 100 km/h) ===', 'blue');
  
  try {
    // Create trip at 100 km/h (current_mileage = 2.63 km/l, worse than baseline 3.5)
    // Distance: 350 km
    // Fuel Price: ₹100/l
    const tripId = 'fuel-wasted-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 350, 100, 100, 'running']
    );

    const result = await pool.query(
      `SELECT distance, live_speed, current_mileage, fuel_used, fuel_saved, money_saved, fuel_price_per_liter 
       FROM trips WHERE id = $1`,
      [tripId]
    );

    const row = result.rows[0];
    if (!row) {
      log('✗ Trip not found', 'red');
      return false;
    }

    log(`Trip Data:`, 'yellow');
    log(`  Distance: ${row.distance} km`, 'yellow');
    log(`  Live Speed: ${row.live_speed} km/h`, 'yellow');
    log(`  Current Mileage: ${row.current_mileage} km/l (worse than 3.5)`, 'yellow');
    log(`  Fuel Used: ${row.fuel_used} liters`, 'yellow');

    // Expected:
    // Baseline: 350 / 3.5 = 100 L
    // Actual: 350 / 2.63 = 133.05 L
    // Since actual > baseline, fuel_saved = 0
    // Money Saved = 0
    log(`\nExpected: fuel_saved = 0, money_saved = 0 (because current_mileage < 3.5)`, 'cyan');
    log(`Actual: fuel_saved = ${row.fuel_saved}, money_saved = ${row.money_saved}`, 'yellow');

    if (row.fuel_saved === 0 && row.money_saved === 0) {
      log('✓ Test 2 PASSED: Fuel saved and money saved are 0 when mileage is worse', 'green');
      return true;
    } else {
      log('✗ Test 2 FAILED: Expected fuel_saved=0 and money_saved=0', 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Test 3: Automatic recalculation on distance change
const testRecalculationOnDistanceChange = async () => {
  log('\n=== Test 3: Auto-recalculation on Distance Change ===', 'blue');
  
  try {
    // Create trip at 50 km/h with initial distance 350 km
    const tripId = 'distance-change-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 350, 50, 100, 'running']
    );

    const result1 = await pool.query(
      `SELECT fuel_saved, money_saved FROM trips WHERE id = $1`,
      [tripId]
    );
    const row1 = result1.rows[0];

    log(`Initial (350 km at 50 km/h):`, 'yellow');
    log(`  Fuel Saved: ${row1.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row1.money_saved}`, 'yellow');

    // Update distance to 700 km (double)
    await pool.query(
      `UPDATE trips SET distance = $1 WHERE id = $2`,
      [700, tripId]
    );

    const result2 = await pool.query(
      `SELECT distance, current_mileage, fuel_used, fuel_saved, money_saved 
       FROM trips WHERE id = $1`,
      [tripId]
    );
    const row2 = result2.rows[0];

    log(`\nAfter distance update (700 km at 50 km/h):`, 'yellow');
    log(`  Distance: ${row2.distance} km`, 'yellow');
    log(`  Current Mileage: ${row2.current_mileage} km/l`, 'yellow');
    log(`  Fuel Used: ${row2.fuel_used} liters`, 'yellow');
    log(`  Fuel Saved: ${row2.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row2.money_saved}`, 'yellow');

    // Expected:
    // Baseline: 700 / 3.5 = 200 L
    // Actual: 700 / 4.38 = 159.82 L
    // Fuel Saved: 200 - 159.82 = 40.18 L
    // Money Saved: 40.18 × 100 = ₹4018
    const expectedFuelSaved = 40.18;
    const expectedMoneySaved = 4018;

    const fuelSavedCorrect = Math.abs(row2.fuel_saved - expectedFuelSaved) < 0.2;
    const moneySavedCorrect = Math.abs(row2.money_saved - expectedMoneySaved) < 20;

    if (fuelSavedCorrect && moneySavedCorrect) {
      log('✓ Test 3 PASSED: Values recalculated correctly on distance change', 'green');
      return true;
    } else {
      log('✗ Test 3 FAILED: Recalculation values incorrect', 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Test 4: Automatic recalculation on speed/mileage change
const testRecalculationOnSpeedChange = async () => {
  log('\n=== Test 4: Auto-recalculation on Speed (Mileage) Change ===', 'blue');
  
  try {
    // Create trip at 50 km/h (current_mileage = 4.38)
    const tripId = 'speed-change-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 350, 50, 100, 'running']
    );

    const result1 = await pool.query(
      `SELECT current_mileage, fuel_used, fuel_saved 
       FROM trips WHERE id = $1`,
      [tripId]
    );
    const row1 = result1.rows[0];

    log(`Initial (50 km/h, current_mileage = ${row1.current_mileage} km/l):`, 'yellow');
    log(`  Fuel Saved: ${row1.fuel_saved} L`, 'yellow');

    // Update speed to 80 km/h (current_mileage = 2.98)
    await pool.query(
      `UPDATE trips SET live_speed = $1 WHERE id = $2`,
      [80, tripId]
    );

    const result2 = await pool.query(
      `SELECT live_speed, current_mileage, fuel_used, fuel_saved, money_saved 
       FROM trips WHERE id = $1`,
      [tripId]
    );
    const row2 = result2.rows[0];

    log(`\nAfter speed update (80 km/h, current_mileage = ${row2.current_mileage} km/l):`, 'yellow');
    log(`  Live Speed: ${row2.live_speed} km/h`, 'yellow');
    log(`  Fuel Used: ${row2.fuel_used} liters`, 'yellow');
    log(`  Fuel Saved: ${row2.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row2.money_saved}`, 'yellow');

    // Expected: Since 2.98 < 3.5, fuel_saved should = 0
    log(`\nExpected: fuel_saved = 0 (current_mileage 2.98 < baseline 3.5)`, 'cyan');

    if (row2.fuel_saved === 0 && row2.money_saved === 0) {
      log('✓ Test 4 PASSED: Correctly set fuel_saved=0 when mileage drops below baseline', 'green');
      return true;
    } else {
      log('✗ Test 4 FAILED: Expected fuel_saved=0 when speed increases', 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Test 5: Automatic recalculation on fuel price change
const testRecalculationOnFuelPriceChange = async () => {
  log('\n=== Test 5: Auto-recalculation on Fuel Price Change ===', 'blue');
  
  try {
    // Create trip at 50 km/h with fuel price ₹100/l
    const tripId = 'fuel-price-change-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 350, 50, 100, 'running']
    );

    const result1 = await pool.query(
      `SELECT fuel_saved, money_saved, fuel_price_per_liter 
       FROM trips WHERE id = $1`,
      [tripId]
    );
    const row1 = result1.rows[0];

    log(`Initial (Fuel Price = ₹${row1.fuel_price_per_liter}/l):`, 'yellow');
    log(`  Fuel Saved: ${row1.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row1.money_saved}`, 'yellow');

    // Update fuel price to ₹150/l
    await pool.query(
      `UPDATE trips SET fuel_price_per_liter = $1 WHERE id = $2`,
      [150, tripId]
    );

    const result2 = await pool.query(
      `SELECT fuel_saved, money_saved, fuel_price_per_liter 
       FROM trips WHERE id = $1`,
      [tripId]
    );
    const row2 = result2.rows[0];

    log(`\nAfter price update (Fuel Price = ₹${row2.fuel_price_per_liter}/l):`, 'yellow');
    log(`  Fuel Saved: ${row2.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row2.money_saved}`, 'yellow');

    // Fuel saved should remain same, but money saved should increase
    // Expected: Fuel Saved ≈ 20.09 L, Money Saved = 20.09 × 150 ≈ ₹3013.5
    const fuelSavedSame = Math.abs(row2.fuel_saved - row1.fuel_saved) < 0.1;
    const moneySavedIncreased = row2.money_saved > row1.money_saved * 1.4; // Should be ~1.5x

    log(`\nExpected: fuel_saved unchanged (≈${row1.fuel_saved}), money_saved increased (≈${(row1.fuel_saved * 150).toFixed(0)})`, 'cyan');

    if (fuelSavedSame && moneySavedIncreased) {
      log('✓ Test 5 PASSED: Money saved recalculated correctly with new fuel price', 'green');
      return true;
    } else {
      log('✗ Test 5 FAILED: Values not recalculated correctly', 'red');
      if (!fuelSavedSame) log(`  Fuel saved changed: ${row1.fuel_saved} → ${row2.fuel_saved}`, 'red');
      if (!moneySavedIncreased) log(`  Money saved not proportional: ${row1.money_saved} → ${row2.money_saved}`, 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Test 6: Zero distance (edge case)
const testZeroDistance = async () => {
  log('\n=== Test 6: Edge Case - Zero Distance ===', 'blue');
  
  try {
    const tripId = 'zero-distance-test-' + Date.now();
    
    await pool.query(
      `INSERT INTO trips (id, uid, vehicle, distance, live_speed, fuel_price_per_liter, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, TEST_UID, TEST_VEHICLE, 0, 50, 100, 'not started']
    );

    const result = await pool.query(
      `SELECT distance, fuel_used, fuel_saved, money_saved 
       FROM trips WHERE id = $1`,
      [tripId]
    );

    const row = result.rows[0];
    log(`Trip with distance = 0:`, 'yellow');
    log(`  Fuel Used: ${row.fuel_used} L`, 'yellow');
    log(`  Fuel Saved: ${row.fuel_saved} L`, 'yellow');
    log(`  Money Saved: ₹${row.money_saved}`, 'yellow');

    if (row.fuel_used === 0 && row.fuel_saved === 0 && row.money_saved === 0) {
      log('✓ Test 6 PASSED: All values are 0 for zero distance', 'green');
      return true;
    } else {
      log('✗ Test 6 FAILED: Expected all values to be 0', 'red');
      return false;
    }
  } catch (err) {
    log(`✗ Error: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  await initDB();
  
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Fuel Saved & Money Saved Calculation Test Suite            ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  const tests = [
    { name: 'Fuel Saved (Better Efficiency)', fn: testFuelSavedBetterEfficiency },
    { name: 'Fuel Saved = 0 (Worse Efficiency)', fn: testFuelSavedWorseEfficiency },
    { name: 'Recalculation on Distance Change', fn: testRecalculationOnDistanceChange },
    { name: 'Recalculation on Speed Change', fn: testRecalculationOnSpeedChange },
    { name: 'Recalculation on Fuel Price Change', fn: testRecalculationOnFuelPriceChange },
    { name: 'Edge Case - Zero Distance', fn: testZeroDistance }
  ];

  let passCount = 0;
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) passCount++;
    } catch (err) {
      log(`Unexpected error in ${test.name}: ${err.message}`, 'red');
    }
  }

  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                      TEST SUMMARY                           ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');
  
  tests.forEach((test, idx) => {
    const result = idx < passCount ? '✓' : '✗';
    log(`${result} ${test.name}`, idx < passCount ? 'green' : 'red');
  });

  log(`\nTotal: ${passCount}/${tests.length} tests passed\n`, passCount === tests.length ? 'green' : 'yellow');

  // Cleanup
  try {
    await pool.query('DELETE FROM trips WHERE uid = $1', [TEST_UID]);
    await pool.query('DELETE FROM users WHERE uid = $1', [TEST_UID]);
    log('✓ Test data cleaned up', 'green');
  } catch (e) {
    log(`⚠ Cleanup error: ${e.message}`, 'yellow');
  }

  await pool.end();
};

runTests().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
