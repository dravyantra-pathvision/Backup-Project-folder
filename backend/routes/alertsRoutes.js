const express = require('express');
const router = express.Router();
const { getAlerts, clearAlerts, createAlert } = require('../controllers/alertsController');

router.get('/', getAlerts);
router.delete('/', clearAlerts);
router.post('/', createAlert);

// Debug ping to verify route wiring
router.get('/ping', (req, res) => {
	console.log('alertsRoutes: /ping hit');
	res.json({ ok: true });
});

module.exports = router;
