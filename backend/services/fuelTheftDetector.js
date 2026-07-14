const fs = require('fs');
const path = require('path');
const { pool } = require('../config/dbconfig');
const alertsStore = require('./alertsStore');
const notificationService = require('./notificationService');

const TRIPS_FILE = path.join(__dirname, '..', 'data', 'trips.json');

// configuration: thresholds and window (seconds)
// thresholds: tune via env vars if needed
const DEFAULT_FUEL_THRESHOLD_LITERS = Number(process.env.FUEL_THEFT_THRESHOLD_LITERS) || 0.7; // liters
const DEFAULT_WINDOW_SECONDS = Number(process.env.FUEL_THEFT_WINDOW_SEC) || 5; // seconds
const RASH_SPEED_THRESHOLD = Number(process.env.RASH_SPEED_THRESHOLD_KMPH) || 80; // km/h
const HARSH_BRAKE_THRESHOLD = Number(process.env.HARSH_BRAKE_THRESHOLD_KMPH) || 40; // drop >=40 km/h within window

// function removed in favor of DB queries

async function persistFuelTheftLoss(tripId, theftFuelLoss) {
  if (!tripId) return;
  const fuelLoss = Number(theftFuelLoss);
  const safeFuelLoss = Number.isFinite(fuelLoss) && fuelLoss > 0 ? Number(fuelLoss.toFixed(2)) : 0;
  const safeMoneyLoss = Number((safeFuelLoss * 100).toFixed(2));
  try {
    await pool.query(
      'UPDATE trips SET theft_fuel_loss = $1, theft_money_loss = $2 WHERE id = $3',
      [safeFuelLoss, safeMoneyLoss, tripId]
    );
  } catch (e) {
    console.error('persistFuelTheftLoss failed', e && e.message);
  }
}

function isDuplicateFuelTheftAlert(existing, incoming) {
  const existingMessage = String(existing && existing.message ? existing.message : '');
  const incomingMessage = String(incoming && incoming.message ? incoming.message : '');
  return existingMessage === incomingMessage;
}

function readLocalTripById(id) {
  try {
    if (!fs.existsSync(TRIPS_FILE)) return null;
    const txt = fs.readFileSync(TRIPS_FILE, 'utf8');
    const list = JSON.parse(txt || '[]');
    return list.find(t => t.id === id) || null;
  } catch (e) {
    console.error('fuelTheftDetector: failed reading trips file', e && e.message);
    return null;
  }
}

function nowIso() { return new Date().toISOString(); }

async function createAlert(payload) {
  try {
    const alert = Object.assign({ id: `${payload.tripId}:${Date.now()}`, detectedAt: nowIso() }, payload);
    await alertsStore.addAlert(alert);
    console.warn('Alert created', alert.tripId, alert);
    
    // Fetch user contact info for notification
      if (uid) {
        const uResult = await pool.query('SELECT contact_email, contact_number FROM fleet_onboarding WHERE uid = $1', [uid]);
        if (uResult.rows.length > 0) {
          const user = uResult.rows[0];
          await notificationService.dispatchAlert(
            payload.type, 
            payload.message, 
            { email: user.contact_email, phone: user.contact_number }
          );
        }
      }
    } catch (notifErr) {
      console.error('Failed to dispatch real-time alert', notifErr && notifErr.message);
    }
    
    return alert;
  } catch (e) {
    console.error('createAlert failed', e && e.message);
    return null;
  }
}

async function checkAndAlert(prevTrip, updatedTrip) {
  try {
    // support old signature where only updatedTrip was passed
    if (typeof updatedTrip === 'undefined') { updatedTrip = prevTrip; prevTrip = null; }
    if (!updatedTrip) return;
    const id = updatedTrip.id;
    const prev = prevTrip || readLocalTripById(id) || {};
    const plate = updatedTrip.vehiclePlate || updatedTrip.vehicle || updatedTrip.vehicle_plate || null;

    // Fetch dynamic thresholds for the vehicle's owner
    let uid = null;
    if (plate) {
      const vResult = await pool.query('SELECT uid FROM vehicles WHERE plate = $1', [plate]);
      if (vResult.rows.length > 0) uid = vResult.rows[0].uid;
    }

    let speedThreshold = RASH_SPEED_THRESHOLD;
    let fuelThreshold = DEFAULT_FUEL_THRESHOLD_LITERS;
    if (uid) {
      const tResult = await pool.query(`
        SELECT
          COALESCE(u.speed_limit_override, fs.speed_threshold, $2) as speed,
          COALESCE(u.fuel_theft_limit_override, fs.fuel_drop_threshold, $3) as fuel
        FROM users u 
        LEFT JOIN fleet_settings fs ON u.uid = fs.uid 
        WHERE u.uid = $1
      `, [uid, RASH_SPEED_THRESHOLD, DEFAULT_FUEL_THRESHOLD_LITERS]);
      if (tResult.rows.length > 0) {
        speedThreshold = Number(tResult.rows[0].speed);
        fuelThreshold = Number(tResult.rows[0].fuel);
      }
    }

    // compute time diff
    let timeDiffSec = DEFAULT_WINDOW_SECONDS + 1;
    if (prev._updatedAt && updatedTrip._updatedAt) {
      const p = new Date(prev._updatedAt).getTime();
      const n = new Date(updatedTrip._updatedAt).getTime();
      if (!isNaN(p) && !isNaN(n)) timeDiffSec = Math.abs(n - p) / 1000;
    } else if (updatedTrip._updatedAt) {
      timeDiffSec = 0;
    }

    // Ensure we're using the DB-provided power flag; only generate movement-related
    // alerts when the vehicle's power is ON. This makes alerts reflect DB state.
    const powerPrev = Boolean(prev.power || prev.power === true);
    const powerNow = Boolean(updatedTrip.power || updatedTrip.power === true);

    // 1) Rash driving: crossing above threshold — only when power is ON
    const prevSpeed = Number(prev.liveSpeed || prev.live_speed || prev.speed || 0);
    const newSpeed = Number(updatedTrip.liveSpeed || updatedTrip.live_speed || updatedTrip.speed || 0);
    if (powerNow && (prevSpeed <= speedThreshold) && (newSpeed > speedThreshold)) {
      await createAlert({
        tripId: id,
        uid: uid,
        vehiclePlate: plate,
        driver: updatedTrip.driverName || updatedTrip.driver || updatedTrip.driver_name || null,
        type: 'rash_driving',
        message: `${updatedTrip.vehicle || updatedTrip.vehiclePlate || 'Vehicle'} is driving rashly at speed ${newSpeed}`,
        prevSpeed,
        newSpeed
      });
    }

    // 2) Harsh braking: sudden large drop within window — only when power is ON
    const speedDrop = prevSpeed - newSpeed;
    if (powerNow && speedDrop > HARSH_BRAKE_THRESHOLD && timeDiffSec <= DEFAULT_WINDOW_SECONDS) {
      await createAlert({
        tripId: id,
        uid: uid,
        vehiclePlate: plate,
        driver: updatedTrip.driverName || updatedTrip.driver || updatedTrip.driver_name || null,
        type: 'harsh_braking',
        message: `Harsh braking detected from ${prevSpeed} -> ${newSpeed} km/h within ${timeDiffSec}s`,
        prevSpeed,
        newSpeed,
        drop: speedDrop
      });
    }

    // 3) Fuel theft (sudden drop in liters within window) — fuel checks independent of power
    if (typeof prev.liveFuelCount !== 'undefined' || typeof prev.live_fuel_count !== 'undefined') {
      const prevFuel = Number(prev.liveFuelCount ?? prev.live_fuel_count ?? 0);
      const newFuel = Number(updatedTrip.liveFuelCount ?? updatedTrip.live_fuel_count ?? 0);
      const delta = prevFuel - newFuel; // positive if decreased
      const threshold = fuelThreshold;
      const storedTheft = Number(updatedTrip.theftFuelLoss ?? updatedTrip.theft_fuel_loss ?? 0);
      const desiredTheft = (prevFuel !== newFuel && delta >= threshold)
        ? Number(delta.toFixed(2))
        : 0;
      console.log('fuelTheftDetector: prevFuel=', prevFuel, 'newFuel=', newFuel, 'delta=', delta);
      console.log('fuelTheftDetector: timeDiffSec=', timeDiffSec, 'threshold=', threshold, 'window=', DEFAULT_WINDOW_SECONDS);
      if (prevFuel !== newFuel && desiredTheft !== storedTheft) {
        await persistFuelTheftLoss(id, desiredTheft);
      }
      if (desiredTheft > 0) {
        await createAlert({
          tripId: id,
          uid: uid,
          vehiclePlate: plate,
          driver: updatedTrip.driverName || updatedTrip.driver || updatedTrip.driver_name || null,
          type: 'fuel_theft',
          message: `Sudden fuel drop detected (${prevFuel} -> ${newFuel} liters) — possible theft`,
          prevFuel,
          newFuel,
          delta
        });
      }
    }

    // 4) Idle: if trip status changed from 'running' to 'idle' — only when power is ON
    const prevStatus = (prev.status || prev.state || '').toString().toLowerCase();
    const newStatus = (updatedTrip.status || updatedTrip.state || '').toString().toLowerCase();
    if (powerNow && prevStatus !== 'idle' && newStatus === 'idle') {
      await createAlert({
        tripId: id,
        uid: uid,
        vehiclePlate: plate,
        driver: updatedTrip.driverName || updatedTrip.driver || updatedTrip.driver_name || null,
        type: 'idle',
        message: `Vehicle entered idle state`,
        prevStatus,
        newStatus
      });
    }

  } catch (e) {
    console.error('fuelTheftDetector error', e && e.message);
  }
  return null;
}

module.exports = { checkAndAlert };
