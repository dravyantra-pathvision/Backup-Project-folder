// middleware/uploadMiddleware.js
// Extracted from L14 of index.js
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
});

module.exports = upload;
