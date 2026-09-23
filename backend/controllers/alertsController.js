// controllers/alertsController.js
// Fully PostgreSQL-backed: create, read, acknowledge, dismiss, clear alerts
// + Full lifecycle: generated → seen → acknowledged → resolved / ignored
const { pool } = require('../config/dbconfig');
const { handleError } = require('../utils/responseHandler');
const { logAuditEvent } = require('../utils/auditLogger');
const alertLifecycleService = require('../services/alertLifecycleService');

const getAlerts = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    const result = await pool.query(
      `SELECT * FROM alerts WHERE uid = $1 AND status != 'dismissed'
       ORDER BY detected_at DESC LIMIT 200`,
      [uid]
    );
    const mapped = result.rows.map(mapAlertRow);
    res.json(mapped);
  } catch (err) {
    handleError(res, 'Error fetching alerts', err);
  }
};

const createAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    const {
      trip, vehiclePlate, vehicle, driver = '',
      type = 'unknown', message = '', severity = 'warning',
      category = 'fuel', detectedAt,
    } = req.body || {};

    const plate = vehiclePlate || vehicle || trip || '';
    const detectedAtVal = detectedAt ? new Date(detectedAt) : new Date();

    const result = await pool.query(
      `INSERT INTO alerts (uid, vehicle_plate, driver, type, message, severity, category, status, detected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING *`,
      [uid, plate, driver, type, message, severity, category, detectedAtVal]
    );
    
    // Simulate Notification Push Dispatch
    try {
      const settingsRes = await pool.query(`SELECT whatsapp_enabled, sms_enabled, email_enabled, push_enabled FROM fleet_settings WHERE uid = $1`, [uid]);
      const orgRes = await pool.query(`SELECT contact_email AS contact FROM fleet_onboarding WHERE uid = $1`, [uid]);
      const userRes = await pool.query(`SELECT email, phone FROM users WHERE uid = $1`, [uid]);
      
      if (settingsRes.rows.length > 0) {
        const settings = settingsRes.rows[0];
        const org = orgRes.rows[0] || {};
        const user = userRes.rows[0] || {};
        
        const contact = org.contact || '';
        const email = contact.includes('@') ? contact : (user.email || '');
        const phone = !contact.includes('@') && contact ? contact : (user.phone || '');
        
        if (settings.whatsapp_enabled && phone) {
          console.log(`✅ [WhatsApp API] Pushing ALERT "${message}" to ${phone}`);
        }
        if (settings.sms_enabled && phone) {
          console.log(`📱 [SMS API] Pushing ALERT "${message}" to ${phone}`);
        }
        if (settings.email_enabled && email) {
          console.log(`📧 [Email API] Pushing ALERT "${message}" to ${email}`);
        }
        if (settings.push_enabled) {
          console.log(`🔔 [FCM Push] Pushing ALERT "${message}" to device`);
        }
      }
    } catch (pushErr) {
      console.error('[Notification Engine] Failed to dispatch alert:', pushErr);
    }
    // Audit Log
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Alerts',
      action: 'Generated',
      newValue: mapAlertRow(result.rows[0])
    }, req);

    res.status(201).json(mapAlertRow(result.rows[0]));
  } catch (err) {
    handleError(res, 'Error creating alert', err);
  }
};

const acknowledgeAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE alerts SET status='acknowledged', acknowledged_at=NOW()
       WHERE id=$1 AND uid=$2 RETURNING *`,
      [id, uid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Alert not found' });
    
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Alerts',
      action: 'Acknowledged',
      newValue: { id }
    }, req);

    res.json(mapAlertRow(result.rows[0]));
  } catch (err) {
    handleError(res, 'Error acknowledging alert', err);
  }
};

const dismissAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE alerts SET status='dismissed', dismissed_at=NOW()
       WHERE id=$1 AND uid=$2 RETURNING *`,
      [id, uid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Alert not found' });
    
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Alerts',
      action: 'Dismissed',
      newValue: { id }
    }, req);

    res.json(mapAlertRow(result.rows[0]));
  } catch (err) {
    handleError(res, 'Error dismissing alert', err);
  }
};

const acknowledgeAllAlerts = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    await pool.query(
      `UPDATE alerts SET status='acknowledged', acknowledged_at=NOW()
       WHERE uid=$1 AND status = 'pending'`,
      [uid]
    );
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Alerts',
      action: 'Acknowledged All',
      newValue: {}
    }, req);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, 'Error acknowledging all alerts', err);
  }
};

const clearAlerts = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    await pool.query(
      `UPDATE alerts SET status='dismissed', dismissed_at=NOW()
       WHERE uid=$1 AND status != 'dismissed'`,
      [uid]
    );
    await logAuditEvent({
      userUid: uid,
      orgUid: uid,
      module: 'Alerts',
      action: 'Cleared All',
      newValue: {}
    }, req);
    res.json({ ok: true, alerts: [] });
  } catch (err) {
    handleError(res, 'Error clearing alerts', err);
  }
};

function mapAlertRow(row) {
  return {
    id:              String(row.id),
    vehiclePlate:    row.vehicle_plate   || '',
    driver:          row.driver          || '',
    type:            row.type            || 'unknown',
    message:         row.message         || '',
    severity:        row.severity        || 'warning',
    category:        row.category        || 'fuel',
    // Legacy status (for backward compat with Flutter)
    status:          row.status          || 'pending',
    // Full lifecycle state (new)
    lifecycleState:  row.lifecycle_state || 'generated',
    detectedAt:      row.detected_at,
    seenAt:          row.seen_at,
    acknowledgedAt:  row.acknowledged_at,
    resolvedAt:      row.resolved_at,
    ignoredAt:       row.ignored_at,
    dismissedAt:     row.dismissed_at,
    lat:             row.lat,
    lng:             row.lng,
    tripId:          row.trip_id,
    source:          row.source,
  };
}

// PUT /api/alerts/:id/seen
const seeAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const row = await alertLifecycleService.transition(id, uid, 'seen');
    if (!row) return res.status(404).json({ error: 'Alert not found' });
    res.json(mapAlertRow(row));
  } catch (err) {
    handleError(res, 'Error marking alert as seen', err);
  }
};

// PUT /api/alerts/:id/resolve
const resolveAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const row = await alertLifecycleService.transition(id, uid, 'resolved');
    if (!row) return res.status(404).json({ error: 'Alert not found' });
    await logAuditEvent({ userUid: uid, orgUid: uid, module: 'Alerts', action: 'Resolved', newValue: { id } }, req);
    res.json(mapAlertRow(row));
  } catch (err) {
    handleError(res, 'Error resolving alert', err);
  }
};

// PUT /api/alerts/:id/ignore
const ignoreAlert = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const row = await alertLifecycleService.transition(id, uid, 'ignored');
    if (!row) return res.status(404).json({ error: 'Alert not found' });
    res.json(mapAlertRow(row));
  } catch (err) {
    handleError(res, 'Error ignoring alert', err);
  }
};

module.exports = { getAlerts, createAlert, acknowledgeAlert, dismissAlert, clearAlerts, acknowledgeAllAlerts, seeAlert, resolveAlert, ignoreAlert };

