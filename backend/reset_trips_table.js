const dotenv = require('dotenv');
dotenv.config();
const { pool, initDB } = require('./db.js');

(async () => {
  try {
    console.log("Dropping trips table...");
    await pool.query('DROP TABLE IF EXISTS trips CASCADE');
    console.log("Trips table dropped. Initializing database schema...");
    await initDB();
    console.log("Trips table recreated successfully!");
  } catch (err) {
    console.error("Error resetting trips table:", err);
  } finally {
    await pool.end();
  }
})();
