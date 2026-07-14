const { pool } = require('../../config/dbconfig');
const admin = require('../../config/firebase');

class ProfileService {
  /**
   * Fetch the profile of the currently logged-in Admin
   */
  async getProfile(uid) {
    const query = `
      SELECT 
        uid, email, full_name, role, created_at, phone, timezone,
        employee_id, department, language_pref, account_status,
        profile_photo, designation, notification_preferences
      FROM users 
      WHERE uid = $1 AND role = 'admin'
    `;
    const result = await pool.query(query, [uid]);
    if (result.rows.length === 0) {
      throw new Error('Admin profile not found');
    }

    // Also get last login from admin_sessions
    const sessionQuery = `
      SELECT login_time 
      FROM admin_sessions 
      WHERE admin_uid = $1 
      ORDER BY login_time DESC 
      LIMIT 1
    `;
    const sessionResult = await pool.query(sessionQuery, [uid]);
    const lastLogin = sessionResult.rows.length > 0 ? sessionResult.rows[0].login_time : null;

    return { ...result.rows[0], last_login: lastLogin };
  }

  /**
   * Update the profile
   */
  async updateProfile(uid, profileData) {
    const { 
      full_name, phone, department, designation, 
      timezone, language_pref 
    } = profileData;

    const query = `
      UPDATE users 
      SET 
        full_name = COALESCE($1, full_name),
        phone = COALESCE($2, phone),
        department = COALESCE($3, department),
        designation = COALESCE($4, designation),
        timezone = COALESCE($5, timezone),
        language_pref = COALESCE($6, language_pref)
      WHERE uid = $7 AND role = 'admin'
      RETURNING *
    `;
    const values = [full_name, phone, department, designation, timezone, language_pref, uid];
    
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Failed to update admin profile');
    }
    return result.rows[0];
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(uid, preferences) {
    const query = `
      UPDATE users 
      SET notification_preferences = $1
      WHERE uid = $2 AND role = 'admin'
      RETURNING notification_preferences
    `;
    const result = await pool.query(query, [preferences, uid]);
    return result.rows[0];
  }

  /**
   * Change admin password using Firebase Admin SDK
   */
  async changePassword(uid, newPassword) {
    // Note: To verify the current password, we'd typically need a client-side re-auth flow 
    // or use Firebase REST API, since Admin SDK bypasses current password.
    // Assuming the controller/client handles verification or it's implicitly trusted here.
    
    await admin.auth().updateUser(uid, {
      password: newPassword
    });

    // Revoke all Firebase refresh tokens
    await admin.auth().revokeRefreshTokens(uid);

    // Invalidate all Postgres backend sessions except the current one
    // (This step happens in the controller where we know the current session token)
  }

  /**
   * Fetch active sessions for the admin
   */
  async getSessions(uid) {
    const query = `
      SELECT id, ip_address, user_agent, browser, os, device, login_time, last_active_time, is_active
      FROM admin_sessions 
      WHERE admin_uid = $1
      ORDER BY last_active_time DESC
    `;
    const result = await pool.query(query, [uid]);
    return result.rows;
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(uid, sessionId) {
    const query = `
      UPDATE admin_sessions 
      SET is_active = false 
      WHERE admin_uid = $1 AND id = $2
      RETURNING id
    `;
    const result = await pool.query(query, [uid, sessionId]);
    if (result.rows.length === 0) {
      throw new Error('Session not found or not authorized to terminate');
    }
    return result.rows[0];
  }

  /**
   * Terminate all sessions except the current one
   */
  async terminateAllOtherSessions(uid, currentToken) {
    const query = `
      UPDATE admin_sessions 
      SET is_active = false 
      WHERE admin_uid = $1 AND session_token != $2
    `;
    await pool.query(query, [uid, currentToken]);
  }

  /**
   * Update profile photo URL
   */
  async updateProfilePhoto(uid, photoUrl) {
    const query = `
      UPDATE users 
      SET profile_photo = $1
      WHERE uid = $2 AND role = 'admin'
      RETURNING profile_photo
    `;
    const result = await pool.query(query, [photoUrl, uid]);
    return result.rows[0];
  }
}

module.exports = new ProfileService();
