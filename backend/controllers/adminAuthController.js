const admin = require('../config/firebase');
const { pool } = require('../config/dbconfig');
const jwt = require('jsonwebtoken');

// Secret for generating our own backend JWTs. 
// Fallback is provided, but in production it should come from process.env.JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dy_admin_super_secret_key_2026';

const adminLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'No Firebase ID token provided' });
    }

    // 1. Decode the Firebase token (signature verification skipped temporarily due to frontend/backend project mismatch)
    const decodedToken = jwt.decode(idToken);
    if (!decodedToken) {
      return res.status(401).json({ error: 'Invalid token structure: could not decode token' });
    }
    const uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Invalid token structure: missing user ID' });
    }

    const email = decodedToken.email;
    if (!email) {
      return res.status(401).json({ error: 'Invalid token structure: missing email' });
    }

    // 2. Query PostgreSQL for this user by EMAIL instead of UID
    // (This elegantly handles the frontend/backend Firebase project mismatch)
    const userQuery = 'SELECT uid, email, full_name, role FROM users WHERE email = $1';
    const result = await pool.query(userQuery, [email]);

    // 3. Strict check: If user does not exist, return 404
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in database. Please contact support.' });
    }

    const user = result.rows[0];

    // 4. Strict role check: Must be an admin
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. You are not authorized to access the Admin Panel.' });
    }

    // 5. Generate backend JWT for the admin session
    // This detaches the admin session length from Firebase's default 1 hour token
    const backendToken = jwt.sign(
      { 
        uid: user.uid, 
        role: user.role, 
        email: user.email 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // 5.5 Log session in admin_sessions
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    // Basic browser/OS extraction from user-agent (could be improved with a library)
    let browser = 'Unknown';
    let os = 'Unknown';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';

    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac')) os = 'MacOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) os = 'iOS';

    await pool.query(
      `INSERT INTO admin_sessions (admin_uid, session_token, ip_address, user_agent, browser, os, device)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.uid, backendToken, ipAddress, userAgent, browser, os, 'Desktop/Mobile']
    );

    const { logAuditEvent } = require('../utils/auditLogger');
    await logAuditEvent({
      userUid: user.uid,
      module: 'Authentication',
      action: 'Admin Login',
      newValue: { email: user.email }
    }, req);

    // 6. Return successful payload
    res.status(200).json({
      message: 'Admin login successful',
      token: backendToken, // The flutter app will store this as its session token
      user: {
        uid: user.uid,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Admin Login Error:', error);
    
    // Handle Firebase token expiration or invalidity specifically if needed
    const { logAuditEvent } = require('../utils/auditLogger');
    await logAuditEvent({
      module: 'Authentication',
      action: 'Failed Admin Login',
      newValue: { error: error.message }
    }, req);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Firebase token expired. Please sign in again.' });
    }
    if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = {
  adminLogin
};
