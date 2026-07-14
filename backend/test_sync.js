const { pool } = require('./config/dbconfig');
const userService = require('./services/userService');

async function test() {
  try {
    const result = await userService.syncUser('3SNtbM0dnWXagoAqGFlEdPZVMYk2', 'guruhugar6777@gmail.com', 'guru', 'admin');
    console.log('Migration successful:', result);
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit(0);
  }
}
test();
