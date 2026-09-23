// services/vehicleHealthEngine.js
// Audited Vehicle Health Engine for DravYantra
// Calculates period-aware normalized vehicle health scores using strictly validated PostgreSQL telemetry.

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

async function getVehicleHealth(uid, vehiclePlate = null, period = 'month', fromDate = null, toDate = null) {
  const { from, to, label } = (period && period !== 'custom')
    ? getPeriodDates(period)
    : {
        from: fromDate ? new Date(fromDate) : null,
        to:   toDate   ? new Date(toDate)   : null,
        label: 'Custom Period',
      };

  // 1) Fleet settings for mileage threshold
  const settingsRes = await pool.query(
    `SELECT mileage_threshold FROM fleet_settings WHERE uid = $1 LIMIT 1`,
    [uid]
  );
  const mileageThreshold = settingsRes.rows.length > 0 ? Number(settingsRes.rows[0].mileage_threshold || 4.0) : 4.0;

  // 2) Vehicles list
  let vQuery = `SELECT * FROM vehicles WHERE uid = $1`;
  const vParams = [uid];
  if (vehiclePlate) {
    vParams.push(vehiclePlate);
    vQuery += ` AND plate = $2`;
  }
  const vehiclesRes = await pool.query(vQuery, vParams);
  const vehicles = vehiclesRes.rows;

  const healthList = [];

  for (const v of vehicles) {
    const plate = v.plate;
    const isActive = v.is_active !== false;

    // Check if telemetry data exists
    if (!isActive || v.status === 'inactive') {
      healthList.push({
        vehicleId: plate,
        registrationNumber: plate,
        healthScore: null,
        status: 'Insufficient Data',
        dataAvailability: {
          vibration: false,
          efficiency: false,
          alerts: false,
          fuelAbnormality: false,
        },
        metrics: {
          vibrationValue: 0,
          efficiencyMetric: 0,
          healthAlertsCount: 0,
          fuelAbnormalityEvents: 0,
        },
        penalties: {
          vibration: 0,
          efficiency: 0,
          alerts: 0,
          fuelAbnormality: 0,
        },
        reasons: ['Vehicle telemetry inactive or insufficient operational data.'],
      });
      continue;
    }

    const config = scoringConfig.vehicleHealth;

    // A. Abnormal Vibration
    const vibrationVal = Number(v.vibration || 0.0);
    const vibrationPenalty = vibrationVal > config.vibrationThreshold
      ? Math.min(config.maxVibrationPenalty, Math.round((vibrationVal - config.vibrationThreshold) * config.vibrationMultiplier))
      : 0;

    // B. Efficiency Degradation
    const currentMil = Number(v.mil || 0.0);
    const efficiencyPenalty = (currentMil > 0 && currentMil < mileageThreshold)
      ? Math.min(config.maxEfficiencyPenalty, Math.round((mileageThreshold - currentMil) * config.efficiencyMultiplier))
      : 0;

    // C. Validated Mechanical/Operating Alerts (excluding pure GPS lost connectivity)
    let alerts = [];
    if (typeof v.alerts === 'string') {
      try { alerts = JSON.parse(v.alerts); } catch (e) { alerts = []; }
    } else if (Array.isArray(v.alerts)) {
      alerts = v.alerts;
    }

    const mechanicalAlerts = alerts.filter(a => {
      const type = (a.type || a.alert_type || '').toString().toLowerCase();
      return type !== 'gpslost' && type !== 'geofence';
    });
    const alertsPenalty = Math.min(config.maxAlertsPenalty, mechanicalAlerts.length * config.alertMultiplier);

    // D. Unprevented Fuel Loss / Abnormality
    const fParams = [uid, plate];
    let fDateFilter = '';
    if (from) { fParams.push(from.toISOString()); fDateFilter += ` AND event_timestamp >= $${fParams.length}`; }
    if (to)   { fParams.push(to.toISOString());   fDateFilter += ` AND event_timestamp <  $${fParams.length}`; }

    const fRes = await pool.query(
      `SELECT COUNT(*) AS evt_count FROM fuel_loss_events
       WHERE uid = $1 AND vehicle_id = $2
         AND (is_prevented IS NOT TRUE AND event_status != 'prevented')${fDateFilter}`,
      fParams
    );
    const fuelDropEvents = Number(fRes.rows[0]?.evt_count || 0);
    const fuelPenalty = Math.min(config.maxFuelPenalty, fuelDropEvents * config.fuelMultiplier);

    // Final Health Score
    const rawScore = config.basePoints - vibrationPenalty - efficiencyPenalty - alertsPenalty - fuelPenalty;
    const finalHealthScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    let status = 'Critical';
    if (finalHealthScore >= 90) status = 'Healthy';
    else if (finalHealthScore >= 75) status = 'Good';
    else if (finalHealthScore >= 60) status = 'Attention Required';

    const reasons = [];
    if (vibrationPenalty > 0) reasons.push(`Abnormal vibration reading recorded (${vibrationVal.toFixed(1)} vs target ${config.vibrationThreshold}).`);
    if (efficiencyPenalty > 0) reasons.push(`Mileage efficiency (${currentMil.toFixed(1)} km/L) degraded below fleet threshold (${mileageThreshold} km/L).`);
    if (mechanicalAlerts.length > 0) reasons.push(`${mechanicalAlerts.length} mechanical/operating alert(s) detected.`);
    if (fuelDropEvents > 0) reasons.push(`${fuelDropEvents} unprevented fuel drop event(s) recorded.`);
    if (reasons.length === 0) reasons.push('All mechanical, fuel, and telemetry health parameters operate within optimal thresholds.');

    healthList.push({
      vehicleId: plate,
      registrationNumber: plate,
      healthScore: finalHealthScore,
      status: status,
      periodLabel: label,
      dataAvailability: {
        vibration: true,
        efficiency: currentMil > 0,
        alerts: true,
        fuelAbnormality: true,
      },
      metrics: {
        vibrationValue: vibrationVal,
        efficiencyMetric: currentMil,
        healthAlertsCount: mechanicalAlerts.length,
        fuelAbnormalityEvents: fuelDropEvents,
      },
      penalties: {
        vibration: vibrationPenalty,
        efficiency: efficiencyPenalty,
        alerts: alertsPenalty,
        fuelAbnormality: fuelPenalty,
      },
      reasons: reasons,
    });
  }

  return vehiclePlate && healthList.length === 1 ? healthList[0] : healthList;
}

module.exports = {
  getVehicleHealth,
};
