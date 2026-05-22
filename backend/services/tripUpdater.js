const { pool } = require('../config/dbconfig');

let _interval = null;

// Configurable via environment variables:
// IDLE_COST_PER_HOUR_RUPEES - rupees charged per 1 hour of idle (default 100)
// TRIP_UPDATER_INTERVAL_MS - updater interval in milliseconds (default 5000)
// DEFAULT_FUEL_PRICE_RUPEES - fallback fuel price per liter (default 100)
const IDLE_COST_PER_HOUR_RUPEES = Number(process.env.IDLE_COST_PER_HOUR_RUPEES || process.env.IDLE_RUPEES_PER_60MIN || 100);
const DEFAULT_FUEL_PRICE_RUPEES = Number(process.env.DEFAULT_FUEL_PRICE_RUPEES || process.env.FUEL_PRICE_RUPEES || 100);

const computeForRow = (row) => {
  const distance = Number(row.distance || 0);
  const fuelUsed = Number(row.fuel_used || 0);
  const defaultMileage = Number(row.default_mileage || 4.0);
  const fuelPrice = Number(row.fuel_price ?? DEFAULT_FUEL_PRICE_RUPEES);

  const currentMileage = fuelUsed > 0 ? distance / fuelUsed : 0.0;
  const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
  const fuelSaved = Math.max(0, expectedFuel - fuelUsed);
  const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);

  const idleSeconds = Number(row.idle_duration || 0);
  const idleRupees = (idleSeconds / 3600) * IDLE_COST_PER_HOUR_RUPEES;
  const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;

  const fuelWasted = fuelWastedMileage + idleLiters;
  const moneySaved = (fuelSaved * fuelPrice) - idleRupees;
  // money wasted = fuel wasted valued at fixed 100 rupees/liter + idle money (100 rupees per 60 minutes)
  const MONEY_WASTED_PER_LITER = 100;
  const moneyWasted = (fuelWasted * MONEY_WASTED_PER_LITER) + idleRupees;

  return {
    currentMileage,
    fuelSaved,
    fuelWasted,
    moneySaved,
    moneyWasted,
    defaultMileage,
    fuelPrice
  };
};

const updateActiveTrips = async () => {
  try {
    const res = await pool.query("SELECT id, uid, distance, fuel_used, default_mileage, idle_duration FROM trips WHERE trip_completed IS NOT TRUE");
    const rows = res.rows || [];
    if (rows.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of rows) {
        const computed = computeForRow(r);
        await client.query(
          `UPDATE trips SET current_mileage = $1, fuel_saved = $2, fuel_wasted = $3, money_saved = $4, money_wasted = $5 WHERE id = $6 AND uid = $7`,
          [computed.currentMileage, computed.fuelSaved, computed.fuelWasted, computed.moneySaved, computed.moneyWasted, r.id, r.uid]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Trip updater transaction error:', e);
    } finally {
      client.release();
    }
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
