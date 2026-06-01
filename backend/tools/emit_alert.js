const fs = require('fs');
const path = require('path');

const alertsPath = path.join(__dirname, '..', 'data', 'alerts.json');

function loadAlerts() {
  try {
    const raw = fs.readFileSync(alertsPath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function saveAlerts(list) {
  fs.writeFileSync(alertsPath, JSON.stringify(list, null, 2), 'utf8');
}

const type = process.argv[2] || 'harsh_braking';
const vehicle = process.argv[3] || 'TRP-0001';
const severity = process.argv[4] || 'high';

const alert = {
  id: `ALRT-${Date.now()}`,
  type,
  vehicle,
  severity,
  timestamp: new Date().toISOString(),
  message: type === 'harsh_braking' ? 'Harsh braking detected' : 'Generated test alert',
  meta: { generatedBy: 'emit_alert.js' }
};

const alerts = loadAlerts();
alerts.unshift(alert);
saveAlerts(alerts);
console.log('Wrote alert:', alert.id, 'to', alertsPath);
