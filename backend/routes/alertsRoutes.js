const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getAlerts, createAlert, acknowledgeAlert,
  dismissAlert, clearAlerts, acknowledgeAllAlerts
} = require('../controllers/alertsController');

router.use(verifyToken);

router.get('/', getAlerts);
router.post('/', createAlert);
router.put('/acknowledge-all', acknowledgeAllAlerts);
router.put('/:id/acknowledge', acknowledgeAlert);
router.put('/:id/dismiss', dismissAlert);
router.delete('/', clearAlerts);

module.exports = router;
