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

module.exports = { getAlerts, clearAlerts };
