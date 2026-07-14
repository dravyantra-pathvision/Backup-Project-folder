const express = require('express');
const router = express.Router();
const auditController = require('../modules/admin/audit.controller');
const { verifyToken } = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');

// Ensure all audit log routes are restricted to admins
router.use(verifyToken);
router.use(requireAdmin);

router.get('/', auditController.getSystemAuditLogs);
router.get('/export', auditController.exportSystemAuditLogs);

module.exports = router;
