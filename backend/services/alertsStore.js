const fs = require('fs');
const path = require('path');

const ALERTS_FILE = path.join(__dirname, '..', 'data', 'alerts.json');

function ensureFile() {
  const dir = path.dirname(ALERTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ALERTS_FILE)) fs.writeFileSync(ALERTS_FILE, JSON.stringify([]), 'utf8');
}

async function getAllAlerts() {
  try {
    ensureFile();
    const txt = fs.readFileSync(ALERTS_FILE, 'utf8');
    return JSON.parse(txt || '[]');
  } catch (e) {
    console.error('Failed to read alerts file', e && e.message);
    return [];
  }
}

async function addAlert(alert) {
  try {
    ensureFile();
    const list = await getAllAlerts();
    // normalize incoming alert
    const tripId = alert.tripId || alert.trip_id || alert.trip || null;
    const type = alert.type || alert.details || alert.message || null;
    // suppress if an unresolved alert with same tripId+type already exists
    const exists = list.find(a => {
      const aTrip = a.tripId || a.trip_id || a.trip || null;
      const aType = a.type || a.details || a.message || null;
      const aStatus = a.status || a.state || null; // treat null as pending
      const unresolved = aStatus !== 'dismissed' && aStatus !== 'acknowledged';
      return aTrip && aType && unresolved && aTrip === tripId && aType === type;
    });
    if (exists) {
      return exists; // do not create duplicate
    }

    const toSave = Object.assign({ status: 'pending' }, alert);
    list.unshift(toSave);
    // keep recent 500 alerts
    const trimmed = list.slice(0, 500);
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    return toSave;
  } catch (e) {
    console.error('Failed to write alert', e && e.message);
    return null;
  }
}

async function clearAllAlerts() {
  try {
    ensureFile();
    fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to clear alerts file', e && e.message);
    return false;
  }
}

module.exports = { getAllAlerts, addAlert, clearAllAlerts };
