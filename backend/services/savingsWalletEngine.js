// services/savingsWalletEngine.js
// Audited Savings Wallet Engine for DravYantra
// Enforces strict separation of Verified Savings, Fuel Loss Prevented, and Identified Waste.

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
      return { from: today, to: new Date(today.getTime() + 86400000), label: 'Today' };

    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Sunday
      return { from: weekStart, to: new Date(today.getTime() + 86400000), label: 'This Week' };
    }

    case 'month':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: new Date(today.getTime() + 86400000), label: 'This Month' };

    case 'last_month': {
      const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { from: firstOfLastMonth, to: firstOfThisMonth, label: 'Last Month' };
    }

    default:
      return { from: null, to: null, label: 'Selected Period' };
  }
}

/**
 * Ensure vehicle baselines exist and manage baseline lifecycle.
 */
async function ensureVehicleBaselines(uid) {
  // 1) Fetch all vehicles for user
  const vehiclesRes = await pool.query(`SELECT plate FROM vehicles WHERE uid = $1`, [uid]);
  const vehicles = vehiclesRes.rows;

  for (const v of vehicles) {
    const plate = v.plate;
    // Check if baseline record exists
    const bRes = await pool.query(
      `SELECT * FROM vehicle_baselines WHERE uid = $1 AND vehicle_id = $2`,
      [uid, plate]
    );

    if (bRes.rows.length === 0) {
      // Create new baseline record in 'collecting' status
      await pool.query(
        `INSERT INTO vehicle_baselines (uid, vehicle_id, baseline_status, baseline_duration_days)
         VALUES ($1, $2, 'collecting', 7)
         ON CONFLICT (uid, vehicle_id) DO NOTHING`,
        [uid, plate]
      );
    }

    // Re-query baseline state
    const bCurrentRes = await pool.query(
      `SELECT * FROM vehicle_baselines WHERE uid = $1 AND vehicle_id = $2`,
      [uid, plate]
    );
    const baseline = bCurrentRes.rows[0];

    if (baseline && baseline.baseline_status === 'collecting') {
      const startDate = new Date(baseline.baseline_start_date);
      const now = new Date();
      const elapsedDays = (now - startDate) / (1000 * 60 * 60 * 24);

      // Check if baseline period (7 days) elapsed OR vehicle has completed trip history
      const tripStatsRes = await pool.query(
        `SELECT COALESCE(SUM(distance), 0) AS total_dist, COALESCE(SUM(fuel_used), 0) AS total_fuel
         FROM trips WHERE uid = $1 AND vehicle = $2 AND trip_completed = TRUE`,
        [uid, plate]
      );
      const totalDist = Number(tripStatsRes.rows[0].total_dist || 0);
      const totalFuel = Number(tripStatsRes.rows[0].total_fuel || 0);

      if (elapsedDays >= (baseline.baseline_duration_days || 7) || totalDist >= 100) {
        const baselineEff = totalFuel > 0 ? (totalDist / totalFuel) : 4.0;
        await pool.query(
          `UPDATE vehicle_baselines
           SET baseline_status = 'completed',
               baseline_end_date = CURRENT_TIMESTAMP,
               baseline_distance = $1,
               baseline_fuel_consumed = $2,
               baseline_efficiency = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE uid = $4 AND vehicle_id = $5`,
          [totalDist, totalFuel, baselineEff, uid, plate]
        );
      }
    }
  }
}

/**
 * Get period Savings Wallet summary.
 */
async function getSavingsWallet(uid, period = 'month', fromDate = null, toDate = null) {
  await ensureVehicleBaselines(uid);

  const { from, to, label } = (period && period !== 'custom')
    ? getPeriodDates(period)
    : {
        from: fromDate ? new Date(fromDate) : null,
        to:   toDate   ? new Date(toDate)   : null,
        label: 'Custom Period',
      };

  const formatDateLocal = (d) => {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  const fuelPriceRes = await pool.query(
    `SELECT fuel_price_per_liter FROM fleet_settings WHERE uid = $1 LIMIT 1`,
    [uid]
  );
  const defaultFuelPrice = fuelPriceRes.rows.length > 0 ? Number(fuelPriceRes.rows[0].fuel_price_per_liter || 95) : 95.0;

  // Fetch all vehicles and baselines
  const vBaselinesRes = await pool.query(
    `SELECT v.plate, vb.baseline_status, vb.baseline_efficiency
     FROM vehicles v
     LEFT JOIN vehicle_baselines vb ON v.uid = vb.uid AND v.plate = vb.vehicle_id
     WHERE v.uid = $1`,
    [uid]
  );

  let totalVerifiedSavingsLiters = 0.0;
  let totalVerifiedSavingsRupees = 0.0;

  let totalPreventedLossLiters = 0.0;
  let totalPreventedLossRupees = 0.0;
  let totalPreventedEvents = 0;

  let totalIdleLiters = 0.0;
  let totalIdleRupees = 0.0;

  let totalSpeedingLiters = 0.0;
  let totalSpeedingRupees = 0.0;
  let totalSpeedingEvents = 0;

  let totalTheftLiters = 0.0;
  let totalTheftRupees = 0.0;
  let totalTheftEvents = 0;

  const vehicleBreakdown = [];

  for (const row of vBaselinesRes.rows) {
    const plate = row.plate;
    const bStatus = row.baseline_status || 'collecting';
    const bEff = Number(row.baseline_efficiency || 4.0);

    // Trip data for this vehicle in period
    const tParams = [uid, plate];
    let tDateFilter = '';
    if (from && to) {
      tParams.push(from.toISOString());
      tParams.push(to.toISOString());
      const fromStr = formatDateLocal(from);
      const toStr = formatDateLocal(new Date(to.getTime() - 1000));
      tParams.push(fromStr);
      tParams.push(toStr);
      tDateFilter += ` AND ((created_at >= $3 AND created_at < $4) OR (updated_at >= $3 AND updated_at < $4) OR (date >= $5 AND date <= $6))`;
    } else if (from) {
      tParams.push(from.toISOString());
      const fromStr = formatDateLocal(from);
      tParams.push(fromStr);
      tDateFilter += ` AND (created_at >= $3 OR updated_at >= $3 OR date >= $4)`;
    } else if (to) {
      tParams.push(to.toISOString());
      const toStr = formatDateLocal(new Date(to.getTime() - 1000));
      tParams.push(toStr);
      tDateFilter += ` AND (created_at < $3 OR date <= $4)`;
    }

    const tRes = await pool.query(
      `SELECT
         COALESCE(SUM(distance), 0) AS dist,
         COALESCE(SUM(fuel_used), 0) AS fuel,
         COALESCE(SUM(idle_money_wasted), 0) AS idle_rs,
         COALESCE(SUM(speeding_fuel_wasted), 0) AS speed_l,
         COALESCE(SUM(speeding_fuel_wasted * fuel_price_per_liter), 0) AS speed_rs,
         COUNT(CASE WHEN speeding_fuel_wasted > 0 THEN 1 END) AS speed_events
       FROM trips WHERE uid = $1 AND vehicle = $2${tDateFilter}`,
      tParams
    );

    const ts = tRes.rows[0];
    const distance = Number(ts.dist || 0);
    const fuelConsumed = Number(ts.fuel || 0);
    const currentEff = fuelConsumed > 0 ? (distance / fuelConsumed) : 0.0;

    // 1) VERIFIED SAVINGS (Only if baseline_status === 'completed')
    let vehicleSavedLiters = 0.0;
    let vehicleSavedRupees = 0.0;

    if (bStatus === 'completed' && bEff > 0 && distance > 0) {
      const expectedFuel = distance / bEff;
      if (expectedFuel > fuelConsumed) {
        vehicleSavedLiters = expectedFuel - fuelConsumed;
        vehicleSavedRupees = vehicleSavedLiters * defaultFuelPrice;
      }
    }

    totalVerifiedSavingsLiters += vehicleSavedLiters;
    totalVerifiedSavingsRupees += vehicleSavedRupees;

    // 2) FUEL LOSS PREVENTED (Only when is_prevented = true OR event_status = 'prevented')
    const eParams = [uid, plate];
    let eDateFilter = '';
    if (from) { eParams.push(from.toISOString()); eDateFilter += ` AND event_timestamp >= $${eParams.length}`; }
    if (to)   { eParams.push(to.toISOString());   eDateFilter += ` AND event_timestamp <  $${eParams.length}`; }

    const pEventsRes = await pool.query(
      `SELECT
         COALESCE(SUM(loss_liters), 0) AS loss_l,
         COALESCE(SUM(loss_rupees), 0) AS loss_rs,
         COUNT(*) AS evt_count
       FROM fuel_loss_events
       WHERE uid = $1 AND vehicle_id = $2
         AND (is_prevented = TRUE OR event_status = 'prevented')${eDateFilter}`,
      eParams
    );
    const pe = pEventsRes.rows[0];
    const vPreventedL = Number(pe.loss_l || 0);
    const vPreventedRs = Number(pe.loss_rs || 0);
    const vPreventedEvts = Number(pe.evt_count || 0);

    totalPreventedLossLiters += vPreventedL;
    totalPreventedLossRupees += vPreventedRs;
    totalPreventedEvents += vPreventedEvts;

    // 3) IDENTIFIED FUEL WASTE
    const vIdleRs = Number(ts.idle_rs || 0);
    const vIdleL = vIdleRs / defaultFuelPrice;
    totalIdleRupees += vIdleRs;
    totalIdleLiters += vIdleL;

    const vSpeedL = Number(ts.speed_l || 0);
    const vSpeedRs = Number(ts.speed_rs || (vSpeedL * defaultFuelPrice));
    const vSpeedEvts = Number(ts.speed_events || 0);
    totalSpeedingLiters += vSpeedL;
    totalSpeedingRupees += vSpeedRs;
    totalSpeedingEvents += vSpeedEvts;

    // Unprevented theft / drops
    const uEventsRes = await pool.query(
      `SELECT
         COALESCE(SUM(loss_liters), 0) AS loss_l,
         COALESCE(SUM(loss_rupees), 0) AS loss_rs,
         COUNT(*) AS evt_count
       FROM fuel_loss_events
       WHERE uid = $1 AND vehicle_id = $2
         AND (is_prevented IS NOT TRUE AND event_status != 'prevented')${eDateFilter}`,
      eParams
    );
    const ue = uEventsRes.rows[0];
    const vTheftL = Number(ue.loss_l || 0);
    const vTheftRs = Number(ue.loss_rs || (vTheftL * defaultFuelPrice));
    const vTheftEvts = Number(ue.evt_count || 0);

    totalTheftLiters += vTheftL;
    totalTheftRupees += vTheftRs;
    totalTheftEvents += vTheftEvts;

    const vWasteLiters = vIdleL + vSpeedL + vTheftL;
    const vWasteRupees = vIdleRs + vSpeedRs + vTheftRs;

    vehicleBreakdown.push({
      vehicleId: plate,
      registrationNumber: plate,
      baselineStatus: bStatus,
      baselineEfficiency: Number(bEff.toFixed(2)),
      currentEfficiency: Number(currentEff.toFixed(2)),
      distance: Number(distance.toFixed(1)),
      fuelConsumed: Number(fuelConsumed.toFixed(1)),
      fuelSavedLiters: Number(vehicleSavedLiters.toFixed(2)),
      fuelSavedRupees: Number(vehicleSavedRupees.toFixed(2)),
      fuelLossPreventedLiters: Number(vPreventedL.toFixed(2)),
      fuelLossPreventedRupees: Number(vPreventedRs.toFixed(2)),
      identifiedWasteLiters: Number(vWasteLiters.toFixed(2)),
      identifiedWasteRupees: Number(vWasteRupees.toFixed(2)),
    });
  }

  const identifiedWasteTotalLiters = totalIdleLiters + totalSpeedingLiters + totalTheftLiters;
  const identifiedWasteTotalRupees = totalIdleRupees + totalSpeedingRupees + totalTheftRupees;

  const result = {
    period: {
      start: from ? from.toISOString() : null,
      end: to ? to.toISOString() : null,
      label: label,
    },
    verifiedSavings: {
      fuelLiters: Number(totalVerifiedSavingsLiters.toFixed(2)),
      rupees: Number(totalVerifiedSavingsRupees.toFixed(2)),
    },
    fuelLossPrevented: {
      liters: Number(totalPreventedLossLiters.toFixed(2)),
      rupees: Number(totalPreventedLossRupees.toFixed(2)),
      events: totalPreventedEvents,
    },
    identifiedWaste: {
      totalLiters: Number(identifiedWasteTotalLiters.toFixed(2)),
      totalRupees: Number(identifiedWasteTotalRupees.toFixed(2)),
      idling: {
        liters: Number(totalIdleLiters.toFixed(2)),
        rupees: Number(totalIdleRupees.toFixed(2)),
      },
      overspeeding: {
        liters: Number(totalSpeedingLiters.toFixed(2)),
        rupees: Number(totalSpeedingRupees.toFixed(2)),
        events: totalSpeedingEvents,
      },
      fuelTheft: {
        liters: Number(totalTheftLiters.toFixed(2)),
        rupees: Number(totalTheftRupees.toFixed(2)),
        events: totalTheftEvents,
      },
    },
    vehicleBreakdown: vehicleBreakdown,
  };

  // If completed month, persist monthly snapshot in monthly_savings_wallet
  if (period === 'last_month' || (period === 'month' && from && new Date() > to)) {
    try {
      const monthYear = from ? `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}` : null;
      if (monthYear) {
        await pool.query(
          `INSERT INTO monthly_savings_wallet (
             uid, month_year, verified_savings_liters, verified_savings_rupees,
             prevented_loss_liters, prevented_loss_rupees, prevented_events,
             identified_waste_liters, identified_waste_rupees, idle_waste_liters, idle_waste_rupees,
             speeding_waste_liters, speeding_waste_rupees, speeding_events,
             theft_waste_liters, theft_waste_rupees, theft_events, vehicle_breakdown, status
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'finalized')
           ON CONFLICT (uid, month_year) DO UPDATE SET
             verified_savings_liters = EXCLUDED.verified_savings_liters,
             verified_savings_rupees = EXCLUDED.verified_savings_rupees,
             prevented_loss_liters   = EXCLUDED.prevented_loss_liters,
             prevented_loss_rupees   = EXCLUDED.prevented_loss_rupees,
             identified_waste_liters = EXCLUDED.identified_waste_liters,
             identified_waste_rupees = EXCLUDED.identified_waste_rupees,
             vehicle_breakdown       = EXCLUDED.vehicle_breakdown,
             status                  = 'finalized',
             updated_at              = CURRENT_TIMESTAMP`,
          [
            uid, monthYear,
            result.verifiedSavings.fuelLiters, result.verifiedSavings.rupees,
            result.fuelLossPrevented.liters, result.fuelLossPrevented.rupees, result.fuelLossPrevented.events,
            result.identifiedWaste.totalLiters, result.identifiedWaste.totalRupees,
            result.identifiedWaste.idling.liters, result.identifiedWaste.idling.rupees,
            result.identifiedWaste.overspeeding.liters, result.identifiedWaste.overspeeding.rupees, result.identifiedWaste.overspeeding.events,
            result.identifiedWaste.fuelTheft.liters, result.identifiedWaste.fuelTheft.rupees, result.identifiedWaste.fuelTheft.events,
            JSON.stringify(result.vehicleBreakdown),
          ]
        );
      }
    } catch (e) {
      console.error('Failed to snapshot monthly savings wallet:', e && e.message);
    }
  }

  return result;
}

module.exports = {
  ensureVehicleBaselines,
  getSavingsWallet,
};
