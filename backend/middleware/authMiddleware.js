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
    const decodedToken = jwt.decode(idToken);

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
      if (email) {
        const result = await pool.query(
          'SELECT uid, role FROM users WHERE email = $1 LIMIT 1',
          [email]
        );
        if (result.rows.length > 0) {
          if (result.rows[0].role) role = result.rows[0].role;
          if (result.rows[0].uid) dbUid = result.rows[0].uid;
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

      if (role === 'admin' || role === 'super_admin') {
        try {
          const sessCheck = await pool.query(
            'SELECT is_active FROM admin_sessions WHERE admin_uid = $1 ORDER BY last_active_time DESC LIMIT 1',
            [dbUid]
          );
          if (sessCheck.rows.length > 0 && sessCheck.rows[0].is_active === false) {
            return res.status(401).json({ error: 'Unauthorized: Session has been revoked' });
          }
        } catch (sErr) {
          // Ignore check failure
        }
      }
    } catch (dbErr) {
      console.warn('[authMiddleware] DB lookup warning:', dbErr.message);
    }

    req.user = { uid: dbUid, email, role };
    next();
  } catch (error) {
    console.error('Error parsing Firebase token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = { verifyToken };
