const { pool } = require('../config/dbconfig');

const requireApprovedOrg = async (req, res, next) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.user.role !== 'fleet_owner') {
      return next();
    }

    const { rows } = await pool.query(
      'SELECT status FROM fleet_onboarding WHERE uid = $1',
      [req.user.uid]
    );

    if (rows.length === 0) {
      // Auto-create approved onboarding record for new fleet owners so they aren't locked out
      await pool.query(
        "INSERT INTO fleet_onboarding (uid, status, company_name) VALUES ($1, 'Approved', 'My Fleet') ON CONFLICT (uid) DO NOTHING",
        [req.user.uid]
      ).catch(e => console.warn('Auto onboarding insert warning:', e.message));
      return next();
    }

    if (rows[0].status !== 'Approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Organization Approval Pending',
        status: rows[0].status
      });
    }

    next();
  } catch (err) {
    console.error('Error in requireApprovedOrg middleware:', err);
    // Allow pass-through on error so app doesn't crash
    next();
  }
};

module.exports = requireApprovedOrg;
