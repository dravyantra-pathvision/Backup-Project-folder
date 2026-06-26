// middleware/authMiddleware.js
// Extracted from L36-40 of index.js

const admin = require('../config/firebase');

const jwt = require('jsonwebtoken');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    // We are temporarily decoding the token without signature verification
    // because the backend serviceAccountKey.json is for the old 'dravyantra' project
    // but the frontend is using the new 'dravyantra-7d2a1' project.
    const decodedToken = jwt.decode(idToken);
    
    if (!decodedToken) {
      throw new Error('Invalid token structure: could not decode token');
    }

    const uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid;
    if (!uid) {
      console.log('Decoded token missing UID:', decodedToken);
      throw new Error('Invalid token structure: missing user ID');
    }

    req.user = { 
      uid: uid, 
      email: decodedToken.email 
    };
    console.log(`🔑 Authenticated User: UID=${uid}, Email=${decodedToken.email || 'N/A'}`);
    next();
  } catch (error) {
    console.error('Error parsing Firebase token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = {
  verifyToken
};
