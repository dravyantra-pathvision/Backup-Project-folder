const { initDB } = require('./config/dbconfig');

(async () => {
  try {
    await initDB();
    console.log('initDB completed');
  } catch (e) {
    console.error('initDB failed', e);
    process.exit(1);
  }
})();
