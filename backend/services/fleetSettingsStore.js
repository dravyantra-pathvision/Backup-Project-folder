const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'fleet_settings.json');

const DEFAULT_SETTINGS = {
  speedThreshold: Number(process.env.RASH_SPEED_THRESHOLD_KMPH) || 80,
  fuelDropThreshold: Number(process.env.FUEL_DROP_THRESHOLD_PERCENT) || 5.0,
};

function ensureFile() {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
  }
}

function readFleetSettings() {
  try {
    ensureFile();
    const txt = fs.readFileSync(SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(txt || '{}');
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (e) {
    console.error('Failed to read fleet settings', e && e.message);
    return { ...DEFAULT_SETTINGS };
  }
}

function updateFleetSettings(nextSettings) {
  try {
    ensureFile();
    const current = readFleetSettings();
    const merged = {
      ...current,
      ...nextSettings,
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    console.error('Failed to write fleet settings', e && e.message);
    return null;
  }
}

module.exports = {
  readFleetSettings,
  updateFleetSettings,
};