// services/telemetry/deviceHealthEngine.js
// LAYER 6 — Device Health Engine
// Updates device monitoring columns on every received packet.

'use strict';
const { pool } = require('../../config/dbconfig');

/**
 * Update device health metrics after receiving a telemetry packet.
 *
 * @param {object} device   Device row from DB
 * @param {object} packet   Incoming telemetry packet
 * @param {object} settings Merged fleet settings
 * @returns {Promise<{ connectionStatus, signalQuality, gpsFixStatus }>}
 */
async function update(device, packet, settings) {
  try {
    const now = new Date();

    // Calculate heartbeat delay
    const lastHeartbeat = device.last_heartbeat ? new Date(device.last_heartbeat) : null;
    let heartbeatDelaySec = null;
    if (lastHeartbeat) {
      heartbeatDelaySec = Math.round((now.getTime() - lastHeartbeat.getTime()) / 1000);
    }

    // Determine connection status
    let connectionStatus = 'online';
    if (heartbeatDelaySec !== null) {
      if (heartbeatDelaySec > settings.heartbeatTimeoutSec * 2) {
        connectionStatus = 'offline';
      } else if (heartbeatDelaySec > settings.heartbeatTimeoutSec) {
        connectionStatus = 'weak_signal';
      }
    }

    // Signal quality from packet or derived from connection status
    let signalQuality = packet.signalQuality || null;
    if (!signalQuality) {
      signalQuality = connectionStatus === 'online' ? 'good'
        : connectionStatus === 'weak_signal'        ? 'weak'
        :                                            'lost';
    }

    // GPS fix status
    const hasGps = packet.lat && packet.lng && packet.lat !== 0 && packet.lng !== 0;
    const gpsFixStatus = hasGps ? 'fixed' : 'searching';

    await pool.query(
      `UPDATE devices SET
         connection_status       = $1,
         last_packet_at          = $2,
         heartbeat_delay_seconds = $3,
         signal_quality          = $4,
         gps_fix_status          = $5,
         battery_voltage         = COALESCE($6, battery_voltage),
         updated_at              = $2
       WHERE device_id = $7`,
      [
        connectionStatus,
        now,
        heartbeatDelaySec,
        signalQuality,
        gpsFixStatus,
        packet.batteryVoltage || null,
        device.device_id,
      ]
    );

    return { connectionStatus, signalQuality, gpsFixStatus };
  } catch (e) {
    console.error('[Device Health Engine] Update failed:', e.message);
    return {};
  }
}

module.exports = { update };
