// middleware/uploadMiddleware.js
// Extracted from L14 of index.js
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

module.exports = upload;
