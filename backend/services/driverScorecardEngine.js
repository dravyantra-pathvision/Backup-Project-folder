// services/driverScorecardEngine.js
// Audited Driver Scorecard Engine for DravYantra
// Calculates period-aware normalized driver safety scores from PostgreSQL trips & telemetry.

'use strict';
const { pool } = require('../config/dbconfig');
const scoringConfig = require('../config/scoringConfig');

function getPeriodDates(period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + 86400000), label: 'Today' };

    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
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

async function getDriverScorecard(uid, driverName = null, period = 'month', fromDate = null, toDate = null) {
  const { from, to, label } = (period && period !== 'custom')
    ? getPeriodDates(period)
    : {
        from: fromDate ? new Date(fromDate) : null,
        to:   toDate   ? new Date(toDate)   : null,
        label: 'Custom Period',
      };

  // 1) Fetch drivers
  let driverQuery = `SELECT * FROM drivers WHERE uid = $1`;
  const dParams = [uid];
  if (driverName) {
    dParams.push(driverName);
    driverQuery += ` AND (name = $2 OR id = $2)`;
  }
  const driversRes = await pool.query(driverQuery, dParams);
  const drivers = driversRes.rows;

  const scorecards = [];

  for (const d of drivers) {
    const dName = d.name;

    // Fetch trip data for this driver in period
    const tParams = [uid, dName];
    let tDateFilter = '';
    if (from) { tParams.push(from.toISOString()); tDateFilter += ` AND created_at >= $${tParams.length}`; }
    if (to)   { tParams.push(to.toISOString());   tDateFilter += ` AND created_at <  $${tParams.length}`; }

    const tRes = await pool.query(
      `SELECT
         COALESCE(SUM(distance), 0) AS total_dist,
         COALESCE(SUM(fuel_used), 0) AS total_fuel,
         COALESCE(SUM(idle_duration), 0) AS total_idle_sec,
         COUNT(*) AS trip_count,
         COUNT(CASE WHEN speeding_fuel_wasted > 0 THEN 1 END) AS speed_events
       FROM trips WHERE uid = $1 AND driver = $2${tDateFilter}`,
      tParams
    );

    const ts = tRes.rows[0];
    const totalDist = Number(ts.total_dist || 0);
    const totalFuel = Number(ts.total_fuel || 0);
    const totalIdleSec = Number(ts.total_idle_sec || 0);
    const tripCount = Number(ts.trip_count || 0);
    const speedEvents = Number(ts.speed_events || 0);
    const harshEvents = Number(d.harsh || 0);

    // Data availability check
    if (totalDist <= 0 && tripCount <= 0) {
      scorecards.push({
        driverId: d.id || dName,
        driverName: dName,
        assignedVehicle: d.vehicle || 'Unassigned',
        score: null,
        status: 'Insufficient Data',
        dataAvailability: {
          exposure: false,
          overspeeding: false,
          idling: false,
          efficiency: false,
          rashDriving: false,
        },
        metrics: {
          distance: 0,
          trips: 0,
          overspeedingEvents: 0,
          overspeedingRate: 0,
          idleDurationMinutes: 0,
          fuelEfficiency: 0,
          rashDrivingEvents: 0,
        },
        penalties: {
          overspeeding: 0,
          idling: 0,
          fuelEfficiency: 0,
          rashDriving: 0,
        },
        reasons: ['No driving telemetry or trip records recorded for the selected period.'],
      });
      continue;
    }

    // Exposure-normalized calculation
    const config = scoringConfig.driverScore;
    const exposureDist = Math.max(1.0, totalDist);

    // A. Overspeeding
    const overspeedingRate = Number(((speedEvents / exposureDist) * 100.0).toFixed(2));
    const overspeedPenalty = Number(Math.min(config.maxOverspeedPenalty, overspeedingRate * config.overspeedRateMultiplier).toFixed(1));

    // B. Idling
    const idleHours = totalIdleSec / 3600.0;
    const idleMinutes = Math.round(totalIdleSec / 60.0);
    const idleRate = Number(((idleHours / exposureDist) * 100.0).toFixed(2));
    const idlingPenalty = Number(Math.min(config.maxIdlingPenalty, idleRate * config.idleRateMultiplier).toFixed(1));

    // C. Fuel Efficiency
    const currentEff = totalFuel > 0 ? (totalDist / totalFuel) : (d.mil || 4.0);
    const baselineEff = Number(d.mil > 0 ? d.mil : 4.0);
    const effRatio = currentEff / baselineEff;
    const efficiencyPenalty = effRatio >= 1.0 ? 0.0 : Number(Math.min(config.maxEfficiencyPenalty, (1.0 - effRatio) * config.efficiencyRatioMultiplier).toFixed(1));

    // D. Rash Driving
    const rashRate = Number(((harshEvents / exposureDist) * 100.0).toFixed(2));
    const rashPenalty = Number(Math.min(config.maxRashPenalty, rashRate * config.rashRateMultiplier).toFixed(1));

    // Final Score Calculation
    const rawScore = config.basePoints - overspeedPenalty - idlingPenalty - efficiencyPenalty - rashPenalty;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    let status = 'Poor';
    if (finalScore >= 90) status = 'Excellent';
    else if (finalScore >= 75) status = 'Good';
    else if (finalScore >= 60) status = 'Needs Improvement';

    const reasons = [];
    if (speedEvents > 0) reasons.push(`${speedEvents} overspeeding event(s) recorded (${overspeedingRate} events per 100 km).`);
    if (idleMinutes > 15) reasons.push(`${idleMinutes} minutes of excess idling recorded.`);
    if (effRatio < 0.95) reasons.push(`Fuel efficiency (${currentEff.toFixed(1)} km/L) was ${((1.0 - effRatio) * 100).toFixed(0)}% below target.`);
    if (harshEvents > 0) reasons.push(`${harshEvents} harsh braking/rash driving event(s) recorded.`);
    if (reasons.length === 0) reasons.push('Optimal driving style with zero safety or idling violations.');

    scorecards.push({
      driverId: d.id || dName,
      driverName: dName,
      assignedVehicle: d.vehicle || 'Unassigned',
      score: finalScore,
      status: status,
      periodLabel: label,
      dataAvailability: {
        exposure: true,
        overspeeding: true,
        idling: true,
        efficiency: true,
        rashDriving: harshEvents > 0,
      },
      metrics: {
        distance: Number(totalDist.toFixed(1)),
        trips: tripCount,
        overspeedingEvents: speedEvents,
        overspeedingRate: overspeedingRate,
        idleDurationMinutes: idleMinutes,
        fuelEfficiency: Number(currentEff.toFixed(2)),
        rashDrivingEvents: harshEvents,
      },
      penalties: {
        overspeeding: overspeedPenalty,
        idling: idlingPenalty,
        fuelEfficiency: efficiencyPenalty,
        rashDriving: rashPenalty,
      },
      reasons: reasons,
    });
  }

  return driverName && scorecards.length === 1 ? scorecards[0] : scorecards;
}

module.exports = {
  getDriverScorecard,
};
