// services/telemetry/gpsEngine.js
// LAYER 2 — GPS Distance Calculation
// Pure function. No DB calls. Returns distance delta in km.

'use strict';
const { getDistanceFromLatLonInKm } = require('../../utils/helpers');

/**
 * Calculate GPS distance delta for a telemetry packet.
 * Applies drift filter and GPS jump rejection.
 *
 * @param {object} vehicle  Current vehicle row (has .lat, .lng)
 * @param {object} packet   Incoming telemetry packet
 * @param {object} settings Merged fleet settings
 * @returns {{ distanceDelta: number, isValidMove: boolean, reason: string|null }}
 */
function calculate(vehicle, packet, settings) {
  const { lat, lng, power, speed } = packet;
  const oldLat = vehicle.lat;
  const oldLng = vehicle.lng;

  // No GPS data in packet
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return { distanceDelta: 0, isValidMove: false, reason: 'no_gps_in_packet' };
  }

  // No previous position recorded
  if (!oldLat || !oldLng) {
    return { distanceDelta: 0, isValidMove: false, reason: 'no_previous_position' };
  }

  // Engine OFF — no movement should be counted
  if (power === false) {
    return { distanceDelta: 0, isValidMove: false, reason: 'engine_off' };
  }

  // Speed is 0 — vehicle stationary
  if (speed === 0) {
    return { distanceDelta: 0, isValidMove: false, reason: 'speed_zero' };
  }

  const rawDistance = getDistanceFromLatLonInKm(
    Number(oldLat), Number(oldLng),
    Number(lat),    Number(lng)
  );

  // Drift filter: ignore sub-threshold GPS jitter
  if (rawDistance < settings.gpsDriftThresholdKm) {
    return { distanceDelta: 0, isValidMove: false, reason: 'gps_drift' };
  }

  // Jump rejection: physically impossible distance between packets
  if (rawDistance > settings.gpsMaxJumpKm) {
    console.warn(`[GPS Engine] Jump rejected: ${rawDistance.toFixed(3)} km from (${oldLat},${oldLng}) to (${lat},${lng})`);
    return { distanceDelta: 0, isValidMove: false, reason: 'gps_jump' };
  }

  return {
    distanceDelta: rawDistance,
    isValidMove: true,
    reason: null,
  };
}

module.exports = { calculate };
