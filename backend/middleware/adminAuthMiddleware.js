const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dy_admin_super_secret_key_2026';

const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided or invalid format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the backend-issued JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ensure the token explicitly grants admin privileges
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access Denied. Admin privileges required.' });
    }

    // Determine if the user is a super admin
    const superAdminUids = (process.env.SUPER_ADMIN_UIDS || '').split(',').map(u => u.trim());
    decoded.isSuperAdmin = superAdminUids.includes(decoded.uid);

    // Attach user payload to request for downstream controllers
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = {
  verifyAdminToken
};
