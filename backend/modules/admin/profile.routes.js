const router = require('express').Router();
const profileController = require('./profile.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for profile photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.uid + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.put('/notifications', profileController.updateNotificationPreferences);
router.put('/password', profileController.changePassword);

router.get('/sessions', profileController.getSessions);
router.delete('/sessions/:sessionId', profileController.terminateSession);

router.post('/photo', upload.single('photo'), profileController.uploadPhoto);
router.delete('/photo', profileController.removePhoto);

module.exports = router;
