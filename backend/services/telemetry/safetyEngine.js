// services/telemetry/safetyEngine.js
// LAYER 5 — Safety Events Engine
// Detects overspeed, harsh braking, rapid acceleration.
// Pure function — no DB calls.

'use strict';

/**
 * Detect safety events from a telemetry packet.
 *
 * @param {object} vehicle  Current vehicle row (has .speed)
 * @param {object} packet   Incoming telemetry packet
 * @param {object} settings Merged fleet settings
 * @returns {{ overspeedEvent, harshBrakingEvent, rapidAccelEvent }}
 */
function process(vehicle, packet, settings) {
  const { speed } = packet;
  const previousSpeed = Number(vehicle.speed || 0);
  const currentSpeed  = Number(speed  || 0);

  const result = {
    overspeedEvent:    false,
    harshBrakingEvent: false,
    rapidAccelEvent:   false,
  };

  if (speed === null || speed === undefined) return result;

  // Overspeed: current speed exceeds configured limit
  if (currentSpeed > settings.overspeedThresholdKmh) {
    result.overspeedEvent = true;
  }

  // Harsh braking: sudden significant speed drop in one packet interval
  if (previousSpeed > 0 && currentSpeed < previousSpeed) {
    const drop = previousSpeed - currentSpeed;
    if (drop >= settings.harshBrakeDeltaKmh) {
      result.harshBrakingEvent = true;
    }
  }

  // Rapid acceleration: sudden significant speed increase in one packet interval
  if (currentSpeed > previousSpeed) {
    const increase = currentSpeed - previousSpeed;
    if (increase >= settings.rapidAccelDeltaKmh) {
      result.rapidAccelEvent = true;
    }
  }

  return result;
}

module.exports = { process };
