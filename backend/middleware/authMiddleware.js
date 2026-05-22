// middleware/authMiddleware.js
// Extracted from L36-40 of index.js

const verifyToken = async (req, res, next) => {
  // Bypassing authentication as requested in the current development configuration
  req.user = { uid: 'default_user', email: 'default@example.com' };
  next();
};

module.exports = {
  verifyToken
};
