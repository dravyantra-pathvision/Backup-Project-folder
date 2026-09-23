// controllers/uploadController.js
const uploadService = require('../services/uploadService');
const { handleError } = require('../utils/responseHandler');

const uploadFile = async (req, res) => {
  try {
    const bucket = req.query.bucket || req.body.bucket || 'general';
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const data = await uploadService.uploadFile(bucket, req.file, req);
    res.json(data);
  } catch (err) {
    handleError(res, 'Upload error', err, 500);
  }
};

module.exports = {
  uploadFile
};
