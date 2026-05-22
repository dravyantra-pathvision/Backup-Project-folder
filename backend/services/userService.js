// services/userService.js
// Extracted SQL operations for L42-61 of index.js
const { pool } = require('../config/dbconfig');

const syncUser = async (uid, email, fullName, role) => {
  const result = await pool.query(
    `INSERT INTO users (uid, email, full_name, role) 
     VALUES ($1, $2, $3, $4) 
     ON CONFLICT (uid) 
     DO UPDATE SET email = EXCLUDED.email, full_name = COALESCE(EXCLUDED.full_name, users.full_name) 
     RETURNING *`,
    [uid, email, fullName, role]
  );
  return result.rows[0];
};

module.exports = {
  syncUser
};
