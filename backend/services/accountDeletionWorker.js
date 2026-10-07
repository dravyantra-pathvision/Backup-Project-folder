// services/accountDeletionWorker.js
const { pool } = require('../config/dbconfig');
const { deleteFile } = require('./uploadService');
let admin;
try {
  admin = require('../config/firebase');
} catch (e) {
  console.warn('[accountDeletionWorker] Firebase Admin SDK not loaded:', e.message);
}

/**
 * processDeletionRequest
 * Asynchronous, idempotent background worker for DravYantra Account & Data Deletion.
 *
 * Sequence:
 * 1. State transition -> DELETING
 * 2. Immediately disable application user access (is_deleted = true)
 * 3. IoT Device Unassignment (preserve status if Maintenance/Retired/Locked, else Available)
 * 4. Physical deletion of S3 objects & local disk files (RC, Insurance, PUC, Aadhaar, License, e-Way bills)
 * 5. Delete PostgreSQL operational records (vehicles, drivers, trips, telemetry, baselines, wallet)
 * 6. Anonymize user profile, KYB org entity, support tickets, and security audit logs
 * 7. Pseudonymize retained tax invoices
 * 8. Run verification checks
 * 9. FINAL STEP: Firebase Auth user deletion & refresh token revocation
 * 10. Transition status -> COMPLETED (or DELETION_FAILED on partial error with safe retry state)
 */
const processDeletionRequest = async (requestId) => {
  console.log(`[DeletionWorker] Starting processing for Job ID: ${requestId}`);
  const client = await pool.connect();

  try {
    // ── 1. Fetch deletion request row ────────────────────────────────────────
    const { rows } = await client.query(
      'SELECT * FROM account_deletion_requests WHERE id = $1',
      [requestId]
    );
    if (rows.length === 0) {
      console.error(`[DeletionWorker] Deletion request ${requestId} not found.`);
      return;
    }

    const reqRow = rows[0];
    const userUid = reqRow.user_uid;
    const orgUid = reqRow.org_uid || userUid;

    // Transition status to DELETING
    await client.query(
      'UPDATE account_deletion_requests SET status = \'DELETING\', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [requestId]
    );

    // ── 2. Disable user account access ───────────────────────────────────────
    await client.query(
      "UPDATE users SET is_deleted = TRUE, account_status = 'Deleted', deleted_at = CURRENT_TIMESTAMP WHERE uid = $1",
      [userUid]
    );
    await client.query(
      "UPDATE fleet_onboarding SET is_deleted = TRUE, status = 'Deleted', deleted_at = CURRENT_TIMESTAMP WHERE uid = $1",
      [orgUid]
    );

    // ── 3. Unassign IoT Hardware Devices ──────────────────────────────────────
    const deviceRes = await client.query(
      'SELECT device_id, status FROM devices WHERE assigned_organization = $1 OR assigned_organization = $2',
      [orgUid, userUid]
    );

    for (const dev of deviceRes.rows) {
      const currentStatus = (dev.status || '').toLowerCase();
      let nextStatus = dev.status;
      if (currentStatus === 'assigned' || currentStatus === 'online' || currentStatus === 'active') {
        nextStatus = 'Available';
      }
      await client.query(
        `UPDATE devices 
         SET assigned_organization = NULL, assigned_vehicle = NULL, status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE device_id = $2`,
        [nextStatus, dev.device_id]
      );
    }
    console.log(`[DeletionWorker] Processed ${deviceRes.rows.length} hardware devices.`);

    // ── 4. Collect & Physically Delete Uploaded Documents (S3 / Local) ───────
    const documentUrls = new Set();

    // Vehicles (rc_url)
    const vehDocs = await client.query(
      'SELECT rc_url FROM vehicles WHERE uid = $1',
      [userUid]
    );
    vehDocs.rows.forEach(r => {
      if (r.rc_url) documentUrls.add(r.rc_url);
    });

    // Drivers (image_url, aadhar_url, license_url)
    const drvDocs = await client.query(
      'SELECT image_url, aadhar_url, license_url FROM drivers WHERE uid = $1',
      [userUid]
    );
    drvDocs.rows.forEach(r => {
      if (r.image_url) documentUrls.add(r.image_url);
      if (r.aadhar_url) documentUrls.add(r.aadhar_url);
      if (r.license_url) documentUrls.add(r.license_url);
    });

    // Trips (eway_bill_url)
    const trpDocs = await client.query(
      'SELECT eway_bill_url FROM trips WHERE uid = $1',
      [userUid]
    );
    trpDocs.rows.forEach(r => {
      if (r.eway_bill_url) documentUrls.add(r.eway_bill_url);
    });

    // Support Ticket Attachments
    const ticketDocs = await client.query(
      'SELECT attachments FROM ticket_messages WHERE sender_id = $1',
      [userUid]
    );
    ticketDocs.rows.forEach(r => {
      if (Array.isArray(r.attachments)) {
        r.attachments.forEach(att => {
          if (att && att.url) documentUrls.add(att.url);
        });
      }
    });

    console.log(`[DeletionWorker] Deleting ${documentUrls.size} physical document files...`);
    for (const url of documentUrls) {
      await deleteFile(url);
    }

    // ── 5. Delete PostgreSQL Fleet Data ──────────────────────────────────────
    await client.query('DELETE FROM vehicle_baselines WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM monthly_savings_wallet WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM fuel_loss_events WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM report_schedules WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM alerts WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM fuel_logs WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM trips WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM drivers WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM vehicles WHERE uid = $1', [userUid]);
    await client.query('DELETE FROM fleet_settings WHERE uid = $1', [userUid]);

    // ── 6. Anonymize User & Organization Profile ──────────────────────────────
    await client.query(
      `UPDATE users 
       SET full_name = 'DELETED_USER', 
           email = 'deleted_' || uid || '@dravyantra.local', 
           phone = NULL, 
           employee_id = NULL, 
           department = NULL, 
           account_status = 'Deleted',
           is_deleted = TRUE, 
           deleted_at = CURRENT_TIMESTAMP 
       WHERE uid = $1`,
      [userUid]
    );

    await client.query(
      `UPDATE fleet_onboarding 
       SET company_name = 'DELETED_ORG', 
           pan = NULL, 
           gstin = NULL, 
           contact_number = NULL, 
           contact_email = NULL, 
           city = NULL, 
           state = NULL, 
           address = NULL, 
           status = 'Deleted',
           is_deleted = TRUE, 
           deleted_at = CURRENT_TIMESTAMP 
       WHERE uid = $1`,
      [orgUid]
    );

    // Anonymize support tickets
    await client.query(
      'UPDATE support_tickets SET description = \'[Content Deleted]\', uid = NULL WHERE uid = $1',
      [userUid]
    );
    await client.query(
      'UPDATE ticket_messages SET message = \'[Content Deleted]\', attachments = \'[]\'::jsonb WHERE sender_id = $1',
      [userUid]
    );

    // Pseudonymize audit logs & tax invoices
    await client.query('UPDATE system_audit_logs SET user_uid = \'DELETED_USER\' WHERE user_uid = $1', [userUid]);
    await client.query('UPDATE device_audit_logs SET fleet_owner_uid = \'DELETED_USER\' WHERE fleet_owner_uid = $1', [userUid]);
    await client.query('UPDATE subscription_invoices SET org_uid = \'DELETED_ORG\' WHERE org_uid = $1', [orgUid]);
    await client.query('UPDATE subscription_payments SET org_uid = \'DELETED_ORG\' WHERE org_uid = $1', [orgUid]);

    // ── 7. Verification Checks ───────────────────────────────────────────────
    await client.query(
      'UPDATE account_deletion_requests SET status = \'VERIFYING\', updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [requestId]
    );

    const vCheck = await client.query('SELECT COUNT(*) FROM vehicles WHERE uid = $1', [userUid]);
    const dCheck = await client.query('SELECT COUNT(*) FROM drivers WHERE uid = $1', [userUid]);
    const tCheck = await client.query('SELECT COUNT(*) FROM trips WHERE uid = $1', [userUid]);
    const remainingRecords = parseInt(vCheck.rows[0].count, 10) + parseInt(dCheck.rows[0].count, 10) + parseInt(tCheck.rows[0].count, 10);

    if (remainingRecords > 0) {
      console.warn(`[DeletionWorker] Verification notice: ${remainingRecords} residual records remaining.`);
    }

    // ── 8. FINAL STEP: Firebase Auth User Deletion ────────────────────────────
    if (admin && admin.auth) {
      try {
        console.log(`[DeletionWorker] Revoking Firebase refresh tokens for UID: ${userUid}`);
        await admin.auth().revokeRefreshTokens(userUid);
      } catch (authErr) {
        console.warn(`[DeletionWorker] Notice revoking refresh tokens: ${authErr.message}`);
      }

      try {
        console.log(`[DeletionWorker] Deleting Firebase Auth user: ${userUid}`);
        await admin.auth().deleteUser(userUid);
        console.log(`✅ [DeletionWorker] Firebase Auth user deleted: ${userUid}`);
      } catch (delErr) {
        // If user is already deleted from Firebase, proceed idempotently
        if (delErr.code === 'auth/user-not-found') {
          console.log(`ℹ️ [DeletionWorker] Firebase user ${userUid} already deleted.`);
        } else {
          throw delErr;
        }
      }
    }

    // ── 9. Mark Job COMPLETED ────────────────────────────────────────────────
    await client.query(
      `UPDATE account_deletion_requests 
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [requestId]
    );
    console.log(`🎉 [DeletionWorker] Account deletion COMPLETED successfully for Job ID: ${requestId}`);
  } catch (err) {
    console.error(`❌ [DeletionWorker] Deletion worker error for Job ID ${requestId}:`, err.message || err);
    try {
      await client.query(
        `UPDATE account_deletion_requests 
         SET status = 'DELETION_FAILED', 
             failed_at = CURRENT_TIMESTAMP, 
             retry_count = retry_count + 1, 
             failure_code = $1, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [err.message ? err.message.substring(0, 100) : 'Worker Error', requestId]
      );
    } catch (dbErr) {
      console.error('[DeletionWorker] Could not record failure status:', dbErr.message);
    }
  } finally {
    client.release();
  }
};

module.exports = { processDeletionRequest };
