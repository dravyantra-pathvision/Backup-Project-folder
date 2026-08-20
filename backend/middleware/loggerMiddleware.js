// middleware/loggerMiddleware.js
// Extracted from L26-30 of index.js

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${new Date().toISOString()} [${res.statusCode}] - ${req.method} ${req.url} (${Date.now() - start}ms)`);
  });
  next();
};

module.exports = {
  requestLogger
};
