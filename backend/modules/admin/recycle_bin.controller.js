// modules/admin/recycle_bin.controller.js
const recycleBinService = require('./recycle_bin.service');
const { handleError } = require('../../utils/responseHandler');
const { logAuditEvent } = require('../../utils/auditLogger');

const getRecycledItems = async (req, res) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const data = await recycleBinService.getRecycledItems({ type, search, page: Number(page), limit: Number(limit) });
    res.json({ success: true, ...data });
  } catch (err) {
    handleError(res, 'Error fetching recycled items', err);
  }
};

const restoreItem = async (req, res) => {
  try {
    const { entity_type, id } = req.body;
    if (!entity_type || !id) {
      return res.status(400).json({ error: 'entity_type and id are required' });
    }
    const result = await recycleBinService.restoreItem({ entity_type, id });
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Recycle Bin',
      action: 'Restored',
      newValue: { entity_type, id }
    }, req);
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Error restoring item from recycle bin', err);
  }
};

const hardDeleteItem = async (req, res) => {
  try {
    const { entity_type, id } = req.body;
    if (!entity_type || !id) {
      return res.status(400).json({ error: 'entity_type and id are required' });
    }
    const result = await recycleBinService.hardDeleteItem({ entity_type, id, adminId: req.user.uid });
    await logAuditEvent({
      userUid: req.user.uid,
      module: 'Recycle Bin',
      action: 'Permanently Deleted',
      newValue: { entity_type, id }
    }, req);
    res.json({ success: true, ...result });
  } catch (err) {
    handleError(res, 'Error permanently deleting item from recycle bin', err);
  }
};

const retryFirebaseCleanup = async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    const adminService = require('./admin.service');
    const result = await adminService.retryFirebaseCleanup(uid, req.user.uid);
    res.json(result);
  } catch (err) {
    handleError(res, 'Error retrying Firebase cleanup', err);
  }
};

module.exports = {
  getRecycledItems,
  restoreItem,
  hardDeleteItem,
  retryFirebaseCleanup,
};
