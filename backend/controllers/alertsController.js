const alertsStore = require('../services/alertsStore');
const { handleError } = require('../utils/responseHandler');
const fs = require('fs');
const path = require('path');
const ALERTS_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

const getAlerts = async (req, res) => {
  try {
    const list = await alertsStore.getAllAlerts();
    res.json(list);
  } catch (err) {
    handleError(res, 'Error fetching alerts', err);
  }
};

const clearAlerts = async (req, res) => {
  try {
    let ok = false;
    try {
      if (alertsStore && typeof alertsStore.clearAllAlerts === 'function') {
        ok = await alertsStore.clearAllAlerts();
      } else {
        // fallback: directly clear the alerts file
        try {
          if (!fs.existsSync(path.dirname(ALERTS_FILE))) fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
          fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2), 'utf8');
          ok = true;
        } catch (e) {
          console.error('fallback clear file failed:', e && e.message);
          ok = false;
        }
      }
    } catch (e) {
      console.error('clearAllAlerts threw:', e && e.message);
      ok = false;
    }
    // Always attempt to return a 200 response; on failure return empty list so UI can continue.
    let list = [];
    try {
      list = await alertsStore.getAllAlerts();
    } catch (e) {
      console.error('getAllAlerts after clear failed:', e && e.message);
      list = [];
    }
    res.json({ ok: ok, alerts: list });
  } catch (err) {
    console.error('Unexpected error in clearAlerts:', err && err.message);
    res.status(200).json({ ok: false, alerts: [] });
  }
};

const createAlert = async (req, res) => {
  try {
    const incoming = req.body || {};
    console.log('createAlert invoked:', req.method, req.originalUrl, 'bodyKeys=', Object.keys(incoming));
    // Normalize some common fields for backward compatibility
    const normalized = Object.assign({}, incoming);
    if (!normalized.time) normalized.time = new Date().toISOString();

    // Persist via alertsStore
    let saved;
    try {
      saved = await alertsStore.addAlert(normalized);
    } catch (e) {
      console.error('alertsController.createAlert: alertsStore.addAlert threw:', e && (e.stack || e.message || e));
    }
    if (saved) {
      console.log('createAlert: persisted via alertsStore');
      return res.status(201).json(saved);
    }

    // Fallback: attempt to persist directly to the alerts file so clients can
    // create alerts even when alertsStore helper fails (e.g., permissions).
    try {
      const fs = require('fs');
      const path = require('path');
      const ALERTS_FILE = path.join(__dirname, '..', 'data', 'alerts.json');
      if (!fs.existsSync(path.dirname(ALERTS_FILE))) fs.mkdirSync(path.dirname(ALERTS_FILE), { recursive: true });
      let list = [];
      try {
        const txt = fs.readFileSync(ALERTS_FILE, 'utf8');
        list = JSON.parse(txt || '[]');
      } catch (e) { list = []; }
      const toSave = Object.assign({ status: 'pending' }, normalized);
      list.unshift(toSave);
      list = list.slice(0, 500);
      // atomic write
      const tmp = ALERTS_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf8');
      fs.renameSync(tmp, ALERTS_FILE);
      console.log('createAlert: fallback persisted to file');
      return res.status(201).json(toSave);
    } catch (e) {
      console.error('alertsController.createAlert: fallback write failed', e && (e.stack || e.message || e));
      // Temporarily include error details to help debugging caller-side
      try {
        return res.status(500).json({ error: 'Failed to save alert', details: String(e && (e.stack || e.message || e)) });
      } catch (er) {
        console.error('alertsController.createAlert: failed to send error response', er && er.message);
        return handleError(res, 'Failed to create alert', e);
      }
    }
  } catch (err) {
    handleError(res, 'Error creating alert', err);
  }
};

module.exports = { getAlerts, clearAlerts, createAlert };
