require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function checkUser() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT uid, email, full_name, role FROM users WHERE email = 'guruhugar0310@gmail.com'");
    console.log("User query result:", res.rows);
    
    if (res.rows.length === 0) {
      console.log("No user found with email guruhugar0310@gmail.com");
      // Search for any user or list fleet_owners
      const allUsers = await client.query("SELECT uid, email, role FROM users LIMIT 10");
      console.log("Sample users:", allUsers.rows);
    }
  } catch (err) {
    console.error("DB error:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

checkUser();
