const { pool } = require('../../config/dbconfig');

class OnboardingService {
  async getStatus(uid) {
    const result = await pool.query(
      `SELECT * FROM fleet_onboarding WHERE uid = $1`,
      [uid]
    );
    if (result.rows.length === 0) {
      // Create a draft row if doesn't exist
      const insert = await pool.query(
        `INSERT INTO fleet_onboarding (uid, company_name, status, profile_completion) VALUES ($1, '', 'Draft', 0) RETURNING *`,
        [uid]
      );
      return insert.rows[0];
    }
    return result.rows[0];
  }

  async updateStep(uid, data, stepId) {
    // Basic dynamic update based on provided data
    const keys = Object.keys(data);
    const values = Object.values(data);
    
    if (keys.length === 0) return this.getStatus(uid);

    const setString = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
    
    // Calculate new completion based on stepId (rough approximation: 1: 25%, 2: 50%, 3: 75%, 4: 100%)
    let completion = 0;
    if (stepId === 1) completion = 25;
    else if (stepId === 2) completion = 50;
    else if (stepId === 3) completion = 75;
    else if (stepId === 4) completion = 100;

    await pool.query(
      `UPDATE fleet_onboarding 
       SET ${setString}, profile_completion = GREATEST(profile_completion, $${keys.length + 2}), last_updated = CURRENT_TIMESTAMP
       WHERE uid = $1`,
      [uid, ...values, completion]
    );

    return this.getStatus(uid);
  }

  async submitForApproval(uid) {
    const res = await pool.query(
      `UPDATE fleet_onboarding 
       SET status = 'Pending Review', submission_date = CURRENT_TIMESTAMP, last_updated = CURRENT_TIMESTAMP
       WHERE uid = $1 RETURNING *`,
      [uid]
    );
    
    const org = res.rows[0];
    
    if (org) {
      await pool.query(
        `INSERT INTO organization_audit_logs (organization_id, action, reason) VALUES ($1, 'Submitted', 'Submitted for admin approval')`,
        [org.id]
      );
    }
    
    return org;
  }
}

module.exports = new OnboardingService();
