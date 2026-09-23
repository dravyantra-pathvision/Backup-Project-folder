// services/fleetStatsEngine.js
// Fleet Statistics Engine.
// Computes time-windowed fleet analytics from the trips table.
// NEVER uses vehicle_lifetime_stats for dashboard output.

'use strict';
const { pool } = require('../config/dbconfig');

/**
 * Compute start/end timestamps for a named period.
 */
function getPeriodDates(period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 86400000) };

    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Sunday
      return { from: weekStart, to: new Date(today.getTime() + 86400000) };
    }

    case 'month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getTime() + 86400000) };

    case 'last_month': {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: firstOfLastMonth, to: firstOfThisMonth };
    }

    case 'year':
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getTime() + 86400000) };

    default:
      return { from: null, to: null };
  }
}

/**
 * Compute fleet statistics for a given period.
 *
 * @param {string}      uid      Organization UID
 * @param {string}      period   'today'|'week'|'month'|'year'|'custom'
 * @param {string|null} fromDate ISO date string (for custom period)
 * @param {string|null} toDate   ISO date string (for custom period)
 */
async function getFleetStats(uid, period = 'today', fromDate = null, toDate = null) {
  const { from, to } = (period && period !== 'custom')
    ? getPeriodDates(period)
    : {
        from: fromDate ? new Date(fromDate) : null,
        to:   toDate   ? new Date(toDate)   : null,
      };

  const formatDateLocal = (d) => {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Build dynamic WHERE clause for trips
  const params = [uid];
  let dateFilter = '';
  if (from && to) {
    params.push(from.toISOString());
    params.push(to.toISOString());
    const fromStr = formatDateLocal(from);
    const toStr = formatDateLocal(new Date(to.getTime() - 1000));
    params.push(fromStr);
    params.push(toStr);
    dateFilter += ` AND ((created_at >= $2 AND created_at < $3) OR (updated_at >= $2 AND updated_at < $3) OR (date >= $4 AND date <= $5))`;
  } else if (from) {
    params.push(from.toISOString());
    const fromStr = formatDateLocal(from);
    params.push(fromStr);
    dateFilter += ` AND (created_at >= $2 OR updated_at >= $2 OR date >= $3)`;
  } else if (to) {
    params.push(to.toISOString());
    const toStr = formatDateLocal(new Date(to.getTime() - 1000));
    params.push(toStr);
    dateFilter += ` AND (created_at < $2 OR date <= $3)`;
  }

  const tripWhere = `uid = $1${dateFilter}`;

  // ── Trip aggregates ──────────────────────────────────────────────────────
  const tripStatsRes = await pool.query(
    `SELECT
       COALESCE(SUM(distance),             0) AS total_distance,
       COALESCE(SUM(fuel_used),            0) AS total_fuel,
       COALESCE(SUM(fuel_saved),           0) AS total_fuel_saved,
       COALESCE(SUM(money_saved),          0) AS total_money_saved,
       COALESCE(SUM(fuel_wasted),          0) AS total_fuel_wasted,
       COALESCE(SUM(money_wasted),         0) AS total_money_wasted,
       COALESCE(SUM(idle_money_wasted),    0) AS idle_money_wasted,
       COALESCE(SUM(speeding_fuel_wasted), 0) AS speeding_fuel_wasted,
       COALESCE(SUM(theft_fuel_loss),      0) AS theft_fuel_loss,
       COALESCE(SUM(theft_money_loss),     0) AS theft_money_loss,
       COALESCE(SUM(co2_emitted),          0) AS total_co2,
       COALESCE(SUM(total_idle_time),      0) AS total_idle_sec,
       COALESCE(SUM(alert_count),          0) AS total_alerts,
       COUNT(*)                               AS trip_count,
       COUNT(CASE WHEN trip_completed = TRUE THEN 1 END) AS completed_trips
     FROM trips
     WHERE ${tripWhere}`,
    params
  );
  const ts = tripStatsRes.rows[0];

  // ── Vehicle live status ──────────────────────────────────────────────────
  const vStatusRes = await pool.query(
    `SELECT
       COUNT(CASE WHEN is_active = TRUE  AND speed > 0  THEN 1 END) AS running,
       COUNT(CASE WHEN is_active = TRUE  AND speed = 0  THEN 1 END) AS idle,
       COUNT(CASE WHEN is_active IS NOT TRUE             THEN 1 END) AS offline
     FROM vehicles WHERE uid = $1`,
    [uid]
  );
  const vs = vStatusRes.rows[0];

  // ── Device status ────────────────────────────────────────────────────────
  const dStatusRes = await pool.query(
    `SELECT
       COUNT(CASE WHEN connection_status = 'online'      THEN 1 END) AS online,
       COUNT(CASE WHEN connection_status = 'offline'
                    OR connection_status IS NULL          THEN 1 END) AS offline,
       COUNT(CASE WHEN connection_status = 'weak_signal' THEN 1 END) AS weak_signal
     FROM devices WHERE assigned_organization = $1`,
    [uid]
  );
  const ds = dStatusRes.rows[0];

  // ── Active trips ─────────────────────────────────────────────────────────
  const activeRes = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM trips
     WHERE uid = $1
       AND trip_completed IS NOT TRUE
       AND status NOT IN ('cancelled','not started','created')`,
    [uid]
  );

  // ── Fuel price (for cost derivation) ─────────────────────────────────────
  const settingsRes = await pool.query(
    'SELECT fuel_price_per_liter FROM fleet_settings WHERE uid = $1',
    [uid]
  );
  const fuelPrice   = Number(settingsRes.rows[0]?.fuel_price_per_liter ?? 92.0);
  const totalFuel   = Number(ts.total_fuel || 0);

  const fuelSavedLiters       = Number(ts.total_fuel_saved || 0);
  const verifiedSavingsRupees  = Number(ts.total_money_saved || 0);

  // CO2 Avoided (kg CO2) strictly from fuel_saved (2.68 kg CO2 / Liter)
  const co2AvoidedKg          = Number((fuelSavedLiters * 2.68).toFixed(2));
  // Carbon (C) Reduced (kg C) derived from CO2 Avoided: co2 * (12/44)
  const carbonReducedKg       = Number((co2AvoidedKg * (12.0 / 44.0)).toFixed(2));

  const idleLossRupees        = Number(ts.idle_money_wasted || 0);
  const idleLossLiters        = fuelPrice > 0 ? Number((idleLossRupees / fuelPrice).toFixed(2)) : 0;
  const speedingLossLiters    = Number(ts.speeding_fuel_wasted || 0);
  const speedingLossRupees    = Number((speedingLossLiters * fuelPrice).toFixed(2));
  const theftLossLiters       = Number(ts.theft_fuel_loss || 0);
  const theftLossRupees       = Number(ts.theft_money_loss || 0);

  const totalLossRupees       = Number(ts.total_money_wasted || 0);
  const totalLossLiters       = Number(ts.total_fuel_wasted || 0);

  // ── Monthly Stats (for charts) ───────────────────────────────────────────
  const monthlyRes = await pool.query(
    `SELECT
       TO_CHAR(created_at, 'Mon') as month,
       COALESCE(SUM(fuel_used), 0) as total_fuel,
       COALESCE(SUM(money_wasted), 0) as total_loss,
       COALESCE(SUM(idle_money_wasted), 0) as idle_wasted
     FROM trips
     WHERE uid = $1
       AND created_at >= date_trunc('year', CURRENT_DATE)
     GROUP BY TO_CHAR(created_at, 'Mon'), EXTRACT(month FROM created_at)
     ORDER BY EXTRACT(month FROM created_at)`,
    [uid]
  );
  const monthlyStats = monthlyRes.rows.map(r => ({
    month: r.month,
    totalFuel: Number(r.total_fuel),
    totalLoss: Number(r.total_loss),
    idleWasted: Number(r.idle_wasted),
  }));

  return {
    period:                 period || 'custom',
    distanceKm:             Number(Number(ts.total_distance || 0).toFixed(2)),
    fuelConsumedL:          Number(totalFuel.toFixed(2)),
    fuelCostRupees:         Number((totalFuel * fuelPrice).toFixed(2)),
    fuelSavedLiters:        Number(fuelSavedLiters.toFixed(2)),
    verifiedSavingsRupees:  Number(verifiedSavingsRupees.toFixed(2)),
    co2AvoidedKg:           co2AvoidedKg,
    carbonReducedKg:        carbonReducedKg,
    idleLossRupees:         idleLossRupees,
    idleLossLiters:         idleLossLiters,
    speedingLossRupees:     speedingLossRupees,
    speedingLossLiters:     speedingLossLiters,
    theftLossRupees:        theftLossRupees,
    theftLossLiters:        theftLossLiters,
    totalLossRupees:        totalLossRupees,
    totalLossLiters:        totalLossLiters,
    tripCount:              Number(ts.trip_count       || 0),
    completedTrips:         Number(ts.completed_trips  || 0),
    alertCount:             Number(ts.total_alerts     || 0),
    idleTimeSeconds:        Number(ts.total_idle_sec   || 0),
    co2EmittedKg:           Number(Number(ts.total_co2 || 0).toFixed(2)),
    vehiclesRunning:        Number(vs.running    || 0),
    vehiclesIdle:           Number(vs.idle       || 0),
    vehiclesOffline:        Number(vs.offline    || 0),
    devicesOnline:          Number(ds.online     || 0),
    devicesOffline:         Number(ds.offline    || 0),
    devicesWeakSignal:      Number(ds.weak_signal || 0),
    activeTripCount:        Number(activeRes.rows[0]?.cnt || 0),
    monthlyStats:           monthlyStats,
  };
}

module.exports = { getFleetStats, getPeriodDates };
