const { pool } = require('./config/dbconfig');

async function updatePendingOrg() {
  const result = await pool.query(`
    UPDATE fleet_onboarding 
    SET is_deleted = false, 
        deleted_at = NULL, 
        company_name = 'Rajshekhar Logistics', 
        status = 'Pending Review', 
        pan = 'ABCDE1234F', 
        gstin = '29ABCDE1234F1Z5', 
        city = 'Bengaluru', 
        state = 'Karnataka', 
        contact_number = '+91 9876543210', 
        contact_email = 'gurupv47@gmail.com', 
        fleet_size = '1-10',
        industry_type = 'Logistics',
        profile_completion = 100,
        submission_date = CURRENT_TIMESTAMP
    WHERE uid = 'bOhjwLjsekSHwBJe3GIxkFVSbet2' 
    RETURNING *;
  `);

  console.log('UPDATED PENDING ONBOARDING IN RDS:', result.rows[0]);

  // Test the admin query output directly
  const adminQuery = await pool.query(`
    SELECT fo.*, u.email, u.full_name, COALESCE(u.phone, fo.contact_number) AS phone, u.role, u.account_status
    FROM fleet_onboarding fo
    LEFT JOIN users u ON fo.uid = u.uid
    WHERE COALESCE(fo.is_deleted, false) = false AND COALESCE(fo.status, '') != 'Deleted'
    ORDER BY fo.created_at DESC;
  `);

  console.log('ADMIN ORGANIZATIONS QUERY ROWS IN AWS RDS:', adminQuery.rows);
  process.exit(0);
}

updatePendingOrg().catch(err => {
  console.error(err);
  process.exit(1);
});
