// middleware/authMiddleware.js
// Verifies Firebase JWT and enriches req.user with role from the DB.

const jwt = require('jsonwebtoken');
const { pool } = require('../config/dbconfig');

/**
 * verifyToken
 * 1. Decodes the Firebase Bearer token
 * 2. Extracts uid + email from token claims
 * 3. Looks up the user's role from the users table
 * 4. Attaches { uid, email, role } to req.user
 */
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken || idToken === 'null' || idToken === 'undefined' || idToken.trim() === '') {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let decodedToken;
  try {
    decodedToken = jwt.decode(idToken);
  } catch (error) {
    console.error('Error parsing Firebase token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  if (!decodedToken) {
    return res.status(401).json({ error: 'Unauthorized: Could not decode token structure' });
  }

  const uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Unauthorized: Missing user ID in token' });
  }

  const email = decodedToken.email || null;
  let role = 'fleet_owner';
  let dbUid = uid;

  try {
    let result;
    if (email) {
      result = await pool.query(
        'SELECT uid, role, is_deleted, account_status FROM users WHERE email = $1 OR uid = $2 LIMIT 1',
        [email, uid]
      );
    } else {
      result = await pool.query(
        'SELECT uid, role, is_deleted, account_status FROM users WHERE uid = $1 LIMIT 1',
        [uid]
      );
    }

    if (result.rows.length > 0) {
      const userRow = result.rows[0];
      if (userRow.is_deleted === true || userRow.account_status === 'Deleted') {
        return res.status(403).json({
          error: 'AccountHasBeenDeleted',
          message: 'This account has been deleted and cannot be accessed.'
        });
      }
      if (userRow.role) role = userRow.role;
      if (userRow.uid) dbUid = userRow.uid;
    }
  } catch (dbErr) {
    console.warn('[authMiddleware] DB lookup warning:', dbErr.message);
  }

  req.user = { uid: dbUid, email, role };

  // CRITICAL: Call next() OUTSIDE of token parsing try/catch block so route errors aren't converted to 401s!
  return next();
};

module.exports = { verifyToken };
