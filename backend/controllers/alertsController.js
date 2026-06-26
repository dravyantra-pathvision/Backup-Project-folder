// controllers/alertsController.js
// Fully PostgreSQL-backed: create, read, acknowledge, dismiss, clear alerts
const { pool } = require('../config/dbconfig');
const { handleError } = require('../utils/responseHandler');

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
    res.json({ ok: true, alerts: [] });
  } catch (err) {
    handleError(res, 'Error clearing alerts', err);
  }
};

function mapAlertRow(row) {
  return {
    id: String(row.id),
    vehiclePlate: row.vehicle_plate || '',
    driver: row.driver || '',
    type: row.type || 'unknown',
    message: row.message || '',
    severity: row.severity || 'warning',
    category: row.category || 'fuel',
    status: row.status || 'pending',
    detectedAt: row.detected_at,
    acknowledgedAt: row.acknowledged_at,
    dismissedAt: row.dismissed_at,
  };
}

module.exports = { getAlerts, createAlert, acknowledgeAlert, dismissAlert, clearAlerts, acknowledgeAllAlerts };
