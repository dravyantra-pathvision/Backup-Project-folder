const { pool } = require('../config/dbconfig');

/**
 * Log a system audit event.
 *
 * @param {Object} params - Parameters for the audit log
 * @param {string} params.userUid - ID of the user performing the action
 * @param {string} params.orgUid - ID of the organization the action belongs to
 * @param {string} params.module - The module being interacted with (e.g., 'Authentication', 'Vehicle', 'Trip')
 * @param {string} params.action - The action being performed (e.g., 'Created', 'Deleted', 'Login')
 * @param {Object} [params.oldValue] - The previous state of the object (optional)
 * @param {Object} [params.newValue] - The new state of the object (optional)
 * @param {Object} req - The Express request object (used to extract IP and Browser)
 */
const logAuditEvent = async ({ userUid, orgUid, module, action, oldValue = null, newValue = null }, req = null) => {
  try {
    let ipAddress = null;
    let browser = null;

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      browser = req.headers['user-agent'];
    }

    const query = `
      INSERT INTO system_audit_logs 
      (user_uid, org_uid, module, action, old_value, new_value, ip_address, browser) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const values = [
      userUid,
      orgUid,
      module,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress,
      browser
    ];

    await pool.query(query, values);
  } catch (error) {
    console.error('Error logging audit event:', error);
    // We intentionally don't throw the error so that audit logging failure 
    // doesn't crash the main business flow, unless business logic strictly demands it.
  }
};

module.exports = {
  logAuditEvent
};
