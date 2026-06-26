const { pool } = require('../config/dbconfig');

let _interval = null;

// Configurable via environment variables:
// IDLE_COST_PER_HOUR_RUPEES - rupees charged per 1 hour of idle (default 100)
// TRIP_UPDATER_INTERVAL_MS - updater interval in milliseconds (default 5000)
// DEFAULT_FUEL_PRICE_RUPEES - fallback fuel price per liter (default 100)
const IDLE_COST_PER_HOUR_RUPEES = Number(process.env.IDLE_COST_PER_HOUR_RUPEES || process.env.IDLE_RUPEES_PER_60MIN || 100);
const DEFAULT_FUEL_PRICE_RUPEES = Number(process.env.DEFAULT_FUEL_PRICE_RUPEES || process.env.FUEL_PRICE_RUPEES || 100);

const parseHhMmSsToSeconds = (hhmmss) => {
  if (!hhmmss || typeof hhmmss !== 'string') return 0;
  const parts = hhmmss.split(':').map(p => Number(p));
  if (parts.length !== 3) return 0;
  const [h, m, s] = parts;
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) return 0;
  return (h * 3600) + (m * 60) + s;
};

const getMileageFromLiveSpeed = (liveSpeed) => {
  const speed = Number(liveSpeed);
  if (!Number.isFinite(speed)) return 0.0;
  if (speed >= 40 && speed < 60) return 4.38;
  if (speed < 70) return 3.5;
  if (speed < 80) return 3.15;
  if (speed < 90) return 2.98;
  if (speed < 100) return 2.8;
  if (speed < 110) return 2.63;
  if (speed < 120) return 2.45;
  return 2.28;
};

const computeForRow = (row) => {
  const distance = Number(row.distance || 0);
  const fuelUsed = Number(row.fuel_used || 0);
  const defaultMileage = Number(row.default_mileage || 4.0);
  const fuelPrice = Number(row.fuel_price ?? DEFAULT_FUEL_PRICE_RUPEES);
  const liveSpeed = Number(row.live_speed ?? row.liveSpeed ?? 0);

  const currentMileage = liveSpeed > 0 ? getMileageFromLiveSpeed(liveSpeed) : (fuelUsed > 0 ? distance / fuelUsed : 0.0);
  const derivedFuelUsed = (distance > 0 && currentMileage > 0) ? Number((distance / currentMileage).toFixed(2)) : 0.0;
  const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
  const fuelSaved = Math.max(0, expectedFuel - derivedFuelUsed);
  const fuelWastedMileage = Math.max(0, derivedFuelUsed - expectedFuel);

  // Prefer live idle time when trip is currently in 'idle' status and
  // `live_idle_time` is provided by telemetry (format HH:MM:SS).
  let idleSeconds = Number(row.idle_duration || 0);
  try {
    const status = (row.status || '').toString().toLowerCase();
    if (status === 'idle' && row.live_idle_time) {
      const parsed = parseHhMmSsToSeconds(row.live_idle_time);
      // use the larger of stored idle_duration and live value to avoid regressions
      if (parsed > idleSeconds) idleSeconds = parsed;
    }
  } catch (e) {
    // Ignore parse errors and fall back to stored idle_duration
  }
  const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
  const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;

  const fuelWasted = fuelWastedMileage + idleLiters;
  const moneySaved = (fuelSaved * fuelPrice) - idleRupees;
  // money wasted = fuel wasted valued at fixed 100 rupees/liter + idle money (100 rupees per 60 minutes)
  const MONEY_WASTED_PER_LITER = 100;
  const moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;
  const speedingFuelWasted = (distance > 0 && currentMileage > 0 && currentMileage < 3.5)
    ? Number(Math.max((distance / currentMileage) - (distance / 3.5), 0).toFixed(2))
    : 0.0;

  return {
    currentMileage,
    fuelUsed: derivedFuelUsed,
    fuelSaved,
    fuelWasted,
    moneySaved,
    moneyWasted,
    speedingFuelWasted,
    defaultMileage,
    fuelPrice
  };
};

const updateActiveTrips = async () => {
  try {
    const res = await pool.query("SELECT id, uid, distance, fuel_used, default_mileage, idle_duration, status, live_idle_time, live_fuel_count, fuel_price, live_speed FROM trips WHERE trip_completed IS NOT TRUE");
    const rows = res.rows || [];
    // DB triggers now own the derived trip fields. This worker is retained
    // only as a compatibility hook and intentionally does not rewrite rows,
    // because that caused the UI to flicker between competing values.
    if (rows.length === 0) return;
  } catch (err) {
    console.error('Error in updateActiveTrips:', err);
  }
};

const start = (intervalMs) => {
  const resolvedInterval = Number(intervalMs || process.env.TRIP_UPDATER_INTERVAL_MS) || 5000;
  if (_interval) return; // already running
  _interval = setInterval(() => {
    updateActiveTrips().catch(err => console.error('Updater error:', err));
  }, resolvedInterval);
  console.log('Trip updater started, intervalMs=', resolvedInterval, 'idleCostPerHour=', IDLE_COST_PER_HOUR_RUPEES);
};

const stop = () => {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
    console.log('Trip updater stopped');
  }
};

module.exports = {
  start,
  stop,
  computeForRow
};
