// controllers/accountController.js
const { pool } = require('../config/dbconfig');
const { processDeletionRequest } = require('../services/accountDeletionWorker');

/**
 * requestAccountDeletion
 * POST /api/account/deletion-request
 * Protected by verifyToken middleware.
 * 
 * Rules:
 * - Derives user_uid strictly from req.user.uid (verified Firebase ID token).
 * - Multi-tenant safe: Resolves org owned by req.user.uid on the server.
 * - Requires UI confirmation phrase 'DELETE MY ACCOUNT'.
 * - Creates deletion job in account_deletion_requests table.
 * - Marks account status as DISABLED immediately.
 * - Triggers asynchronous background deletion worker.
 * - Returns 202 Accepted.
 */
const requestAccountDeletion = async (req, res) => {
  try {
    const userUid = req.user.uid;
    const { confirmPhrase } = req.body || {};

    if (!confirmPhrase || confirmPhrase.trim() !== 'DELETE MY ACCOUNT') {
      return res.status(400).json({
        success: false,
        error: 'Invalid confirmation phrase. Please type "DELETE MY ACCOUNT" exactly to confirm.',
      });
    }

    // 0. Auto-create account_deletion_requests table if not existing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id SERIAL PRIMARY KEY,
        user_uid VARCHAR(128) NOT NULL,
        org_uid VARCHAR(128),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        failed_at TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        failure_code VARCHAR(100),
        idempotency_key VARCHAR(128) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 1. Resolve organization owned by req.user.uid (Multi-Tenant Protection)
    let orgUid = userUid;
    try {
      const orgRes = await pool.query(
        'SELECT uid, status FROM fleet_onboarding WHERE uid = $1',
        [userUid]
      );
      if (orgRes.rows.length > 0) orgUid = orgRes.rows[0].uid;
    } catch (_) {}

    // 2. Check for existing active deletion request
    const existingJob = await pool.query(
      `SELECT id, status FROM account_deletion_requests 
       WHERE user_uid = $1 AND status IN ('PENDING', 'DISABLED', 'DELETING', 'VERIFYING') 
       ORDER BY id DESC LIMIT 1`,
      [userUid]
    );

    if (existingJob.rows.length > 0) {
      const active = existingJob.rows[0];
      return res.status(202).json({
        success: true,
        message: 'Account deletion is already in progress.',
        jobId: active.id,
        status: active.status,
      });
    }

    // 3. Create deletion request with idempotency key
    const idempotencyKey = `del_${userUid}_${Date.now()}`;
    const insertRes = await pool.query(
      `INSERT INTO account_deletion_requests (user_uid, org_uid, status, idempotency_key)
       VALUES ($1, $2, 'DISABLED', $3)
       RETURNING id, status, requested_at`,
      [userUid, orgUid, idempotencyKey]
    );

    const jobId = insertRes.rows[0].id;

    // 4. Mark application user as DISABLED
    await pool.query(
      'UPDATE users SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE uid = $1',
      [userUid]
    );

    // 5. Enqueue background deletion worker asynchronously
    setImmediate(() => {
      processDeletionRequest(jobId).catch(err => {
        console.error(`[accountController] Async worker error for job ${jobId}:`, err);
      });
    });

    return res.status(202).json({
      success: true,
      message: 'Your DravYantra account deletion request has been submitted and processing has begun.',
      jobId,
      status: 'DISABLED',
      requestedAt: insertRes.rows[0].requested_at,
    });
  } catch (err) {
    console.error('Error initiating account deletion:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit account deletion request. Please try again or contact support.',
    });
  }
};

/**
 * getDeletionStatus
 * GET /api/account/deletion-status
 * Returns current status of deletion request for client UI.
 */
const getDeletionStatus = async (req, res) => {
  try {
    const userUid = req.user.uid;
    const { rows } = await pool.query(
      `SELECT id, status, requested_at, started_at, completed_at, failed_at 
       FROM account_deletion_requests 
       WHERE user_uid = $1 
       ORDER BY id DESC LIMIT 1`,
      [userUid]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        hasDeletionRequest: false,
      });
    }

    return res.json({
      success: true,
      hasDeletionRequest: true,
      deletionRequest: rows[0],
    });
  } catch (err) {
    console.error('Error fetching deletion status:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

module.exports = {
  requestAccountDeletion,
  getDeletionStatus,
};
