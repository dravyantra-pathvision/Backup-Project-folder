// middleware/roleMiddleware.js
// Role-based access control middleware.
// Always use AFTER verifyToken — requires req.user to be populated.

/**
 * requireRole(roles)
 * Factory that returns a middleware enforcing that req.user.role
 * is one of the allowed roles.
 *
 * Usage:
 *   router.get('/admin/dashboard', verifyToken, requireRole(['admin']), controller.getDashboard);
 *   router.get('/vehicles',        verifyToken, requireRole(['admin', 'fleet_owner']), controller.list);
 *
 * @param {string[]} roles - Array of allowed role strings
 */
const requireRole = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  if (!roles.includes(req.user.role)) {
    console.warn(
      `🚫 Access denied: uid=${req.user.uid} has role="${req.user.role}" but route requires [${roles.join(', ')}]`
    );
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to access this resource',
      required_role: roles,
      your_role: req.user.role,
    });
  }

  next();
};

module.exports = { requireRole };
