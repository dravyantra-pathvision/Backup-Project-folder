require('dotenv').config();
const userService = require('./services/userService');
const { pool } = require('./config/dbconfig');

async function testUserSync() {
  console.log("Testing PostgreSQL user sync...");
  const testUid = 'test-uid-' + Date.now();
  const testEmail = `testuser_${Date.now()}@dravyantra.com`;
  const testName = 'Test User Verification';

  try {
    const user = await userService.syncUser(testUid, testEmail, testName, 'fleet_owner');
    console.log("[PASS] User synced to PostgreSQL:", user);

    const check = await pool.query('SELECT uid, email, full_name, role, created_at FROM users WHERE uid = $1', [testUid]);
    console.log("[PASS] Query result from PostgreSQL AWS RDS:", check.rows);
  } catch (err) {
    console.error("[FAIL] User sync failed:", err);
  } finally {
    process.exit(0);
  }
}

testUserSync();
