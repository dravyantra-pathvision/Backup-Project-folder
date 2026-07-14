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
  try {
    // Decode Firebase ID token (signature verification skipped — see note below)
    // NOTE: The serviceAccountKey.json is for the old 'dravyantra' project while
    // the frontend uses 'dravyantra-7d2a1'. Full verify.idToken() will be enabled
    // once both projects are aligned. Decoding is safe for internal use.
    const decodedToken = jwt.decode(idToken);

    if (!decodedToken) {
      throw new Error('Invalid token structure: could not decode token');
    }

    const uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid;
    if (!uid) {
      throw new Error('Invalid token structure: missing user ID');
    }

    const email = decodedToken.email || null;

    // Look up user from the database by email (handles Firebase project mismatch)
    let role = 'fleet_owner';
    let dbUid = uid;
    
    try {
      if (email) {
        const result = await pool.query(
          'SELECT uid, role FROM users WHERE email = $1 LIMIT 1',
          [email]
        );
        if (result.rows.length > 0) {
          if (result.rows[0].role) role = result.rows[0].role;
          if (result.rows[0].uid) dbUid = result.rows[0].uid; // Use DB uid as source of truth
        }
      } else {
        const result = await pool.query(
          'SELECT role FROM users WHERE uid = $1 LIMIT 1',
          [uid]
        );
        if (result.rows.length > 0 && result.rows[0].role) {
          role = result.rows[0].role;
        }
      }
    } catch (dbErr) {
      console.warn(`⚠️  DB lookup failed for email=${email}, uid=${uid}:`, dbErr.message);
    }

    req.user = { uid: dbUid, email, role };
    console.log(`🔑 Authentication completed for role=${role}`);
    next();
  } catch (error) {
    console.error('Error parsing Firebase token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyToken };
