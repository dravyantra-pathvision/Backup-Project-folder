// routes/uploadRoutes.js
const router = require('express').Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/uploadMiddleware');

router.post('/', upload.single('file'), uploadController.uploadFile);

module.exports = router;
