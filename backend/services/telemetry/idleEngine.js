// services/telemetry/idleEngine.js
// LAYER 4 — Idle / Moving / Running Time Engine
// Tracks engine-on states and triggers idle alerts at configured thresholds.

'use strict';

/**
 * Process idle/moving/running time from a telemetry packet.
 *
 * @param {object|null} trip       Active trip row (may be null)
 * @param {object} packet          Incoming telemetry packet
 * @param {object} settings        Merged fleet settings
 * @param {number} timeDeltaSec    Seconds elapsed since last update (caller-supplied, capped)
 * @returns {{ idleDeltaSec, movingDeltaSec, runningDeltaSec, warningTriggered, criticalTriggered }}
 */
function process(trip, packet, settings, timeDeltaSec) {
  const { power, speed } = packet;

  // Cap delta to 60s to prevent enormous jumps if a packet was delayed
  const delta = Math.min(Math.max(timeDeltaSec, 0), 60);

  const result = {
    idleDeltaSec:       0,
    movingDeltaSec:     0,
    runningDeltaSec:    0,
    warningTriggered:   false,
    criticalTriggered:  false,
  };

  // Engine OFF — nothing accumulates
  if (!power) return result;

  // Engine ON — accumulate running time regardless of speed
  result.runningDeltaSec = delta;

  const isStationary = (speed === 0 || speed === null || speed === undefined);

  if (isStationary) {
    // Engine ON + Speed 0 = IDLE
    result.idleDeltaSec = delta;

    // Check alert thresholds (only fire once per crossing)
    if (trip) {
      const prevIdleTotal = Number(trip.total_idle_time || 0);
      const newIdleTotal  = prevIdleTotal + delta;

      if (prevIdleTotal < settings.idleWarningSec && newIdleTotal >= settings.idleWarningSec) {
        result.warningTriggered = true;
      }
      if (prevIdleTotal < settings.idleCriticalSec && newIdleTotal >= settings.idleCriticalSec) {
        result.criticalTriggered = true;
      }
    }
  } else {
    // Engine ON + Speed > 0 = MOVING
    result.movingDeltaSec = delta;
  }

  return result;
}

module.exports = { process };
