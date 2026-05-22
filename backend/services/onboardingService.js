// services/onboardingService.js
// Extracted SQL operations for L63-99 of index.js
const { pool } = require('../config/dbconfig');

const getOnboarding = async (uid) => {
  const result = await pool.query(
    'SELECT * FROM fleet_onboarding WHERE uid = $1',
    [uid]
  );
  return result.rows[0] || null;
};

const saveOnboarding = async (uid, companyName, gstin, contactNumber, city, state) => {
  const result = await pool.query(
    `INSERT INTO fleet_onboarding (uid, company_name, gstin, contact_number, city, state) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     ON CONFLICT (uid) 
     DO UPDATE SET 
       company_name = EXCLUDED.company_name,
       gstin = EXCLUDED.gstin,
       contact_number = EXCLUDED.contact_number,
       city = EXCLUDED.city,
       state = EXCLUDED.state
     RETURNING *`,
    [uid, companyName, gstin, contactNumber, city, state]
  );
  return result.rows[0];
};

module.exports = {
  getOnboarding,
  saveOnboarding
};
