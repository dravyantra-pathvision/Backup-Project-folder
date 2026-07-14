const { pool } = require('./config/dbconfig');
async function fix() {
  await pool.query("UPDATE fleet_onboarding SET uid = '3SNtbM0dnWXagoAqGFlEdPZVMYk2' WHERE uid = 'M8Vi6Aj9IPN358P4ztL2Yi1V8PG3'");
  await pool.query("UPDATE users SET uid = '3SNtbM0dnWXagoAqGFlEdPZVMYk2' WHERE uid = 'M8Vi6Aj9IPN358P4ztL2Yi1V8PG3'");
  console.log('Fixed UIDs!');
  process.exit(0);
}
fix().catch(console.error);
