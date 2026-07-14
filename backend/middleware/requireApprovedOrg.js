const { pool } = require('../config/dbconfig');

const requireApprovedOrg = async (req, res, next) => {
  try {
    // We assume req.user is populated by authenticateToken middleware
    if (req.user.role !== 'fleet_owner') {
      // If admin or driver, let them pass for now. 
      // In a strict setup, you might restrict drivers based on org status as well,
      // but usually this restricts the fleet_owner actions.
      return next();
    }

    const { rows } = await pool.query(
      'SELECT status FROM fleet_onboarding WHERE uid = $1',
      [req.user.uid]
    );

    console.log('🔍 requireApprovedOrg status check for uid:', req.user.uid, 'status:', rows.length > 0 ? rows[0].status : 'Not Found');

    if (rows.length === 0 || rows[0].status !== 'Approved') {
      return res.status(403).json({ 
        success: false, 
        message: 'Organization Approval Pending',
        status: rows.length > 0 ? rows[0].status : 'Not Found'
      });
    }

    next();
  } catch (err) {
    console.error('Error in requireApprovedOrg middleware:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

module.exports = requireApprovedOrg;
