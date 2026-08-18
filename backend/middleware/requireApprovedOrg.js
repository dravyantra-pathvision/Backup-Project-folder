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
      // No org profile submitted yet — user must complete the onboarding wizard first.
      // Do NOT auto-approve: the correct flow is wizard → Pending Review → admin approves.
      return res.status(403).json({
        success: false,
        message: 'Organization profile not submitted',
        status: 'Draft'
      });
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
