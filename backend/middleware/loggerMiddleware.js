// middleware/loggerMiddleware.js
// Extracted from L26-30 of index.js

const requestLogger = (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
};

module.exports = {
  requestLogger
};
