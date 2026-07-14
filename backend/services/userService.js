// services/userService.js
const { pool } = require('../config/dbconfig');

const syncUser = async (uid, email, fullName, role) => {
  const existingEmail = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);

  if (existingEmail.rows.length > 0) {
    const existingUser = existingEmail.rows[0];
    if (existingUser.uid !== uid) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // 1. Create the new user with a temporary email to satisfy foreign key constraints
        await client.query(`INSERT INTO users (uid, email, full_name, role) VALUES ($1, $2, $3, $4)`, [uid, email + '_temp_' + Date.now(), fullName || existingUser.full_name, role || existingUser.role]);
        
        // 2. Migrate all child records to the new uid
        await client.query(`UPDATE fleet_onboarding SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE vehicles SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE drivers SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE fuel_logs SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE trips SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE fleet_settings SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        await client.query(`UPDATE alerts SET uid=$1 WHERE uid=$2`, [uid, existingUser.uid]);
        
        // 3. Delete the old user (frees up the original email)
        await client.query(`DELETE FROM users WHERE uid=$1`, [existingUser.uid]);
        
        // 4. Update the new user with the original email
        const result = await client.query(
          `UPDATE users SET email=$1 WHERE uid=$2 RETURNING *`,
          [email, uid]
        );
        await client.query('COMMIT');
        return result.rows[0];
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const result = await pool.query(
        `UPDATE users SET full_name=COALESCE(full_name, $2), role=COALESCE(role, $3) WHERE uid=$1 RETURNING *`,
        [uid, fullName, role]
      );
      return result.rows[0];
    }
  }

  const result = await pool.query(
    `INSERT INTO users (uid, email, full_name, role)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (uid) DO UPDATE SET
       email=EXCLUDED.email,
       full_name=COALESCE(users.full_name, EXCLUDED.full_name)
     RETURNING *`,
    [uid, email, fullName, role]
  );
  return result.rows[0];
};

const getProfileAndOrg = async (uid) => {
  const userRes = await pool.query(`SELECT * FROM users WHERE uid=$1`, [uid]);
  const orgRes  = await pool.query(`SELECT * FROM fleet_onboarding WHERE uid=$1`, [uid]);
  return {
    user: userRes.rows[0] || null,
    org:  orgRes.rows[0]  || null,
  };
};

const updateProfile = async (uid, fields) => {
  const {
    full_name, phone, timezone,
    employee_id, department, language_pref,
    email_notif, sms_notif, push_notif,
    speed_limit_override, fuel_theft_limit_override,
    idle_duration_override, low_mileage_override,
  } = fields;

  const result = await pool.query(
    `UPDATE users SET
       full_name               = COALESCE($2, full_name),
       phone                   = COALESCE($3, phone),
       timezone                = COALESCE($4, timezone),
       employee_id             = COALESCE($5, employee_id),
       department              = COALESCE($6, department),
       language_pref           = COALESCE($7, language_pref),
       email_notif             = COALESCE($8, email_notif),
       sms_notif               = COALESCE($9, sms_notif),
       push_notif              = COALESCE($10, push_notif),
       speed_limit_override    = $11,
       fuel_theft_limit_override = $12,
       idle_duration_override  = $13,
       low_mileage_override    = $14
     WHERE uid=$1
     RETURNING *`,
    [uid, full_name, phone, timezone,
     employee_id, department, language_pref,
     email_notif, sms_notif, push_notif,
     speed_limit_override !== undefined ? speed_limit_override : null,
     fuel_theft_limit_override !== undefined ? fuel_theft_limit_override : null,
     idle_duration_override !== undefined ? idle_duration_override : null,
     low_mileage_override !== undefined ? low_mileage_override : null,
    ]
  );
  return result.rows[0];
};

const updateOrganization = async (uid, fields) => {
  const {
    company_name, gstin, pan, contact_number, contact_email,
    city, state, address, country,
    fleet_size, industry_type,
  } = fields;

  const query = `
      INSERT INTO fleet_onboarding 
       (uid, company_name, gstin, pan, contact_number, contact_email, city, state, address, country, fleet_size, industry_type)
      VALUES 
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (uid) DO UPDATE SET
       company_name    = COALESCE(EXCLUDED.company_name,  fleet_onboarding.company_name),
       gstin           = COALESCE(EXCLUDED.gstin,         fleet_onboarding.gstin),
       pan             = COALESCE(EXCLUDED.pan,           fleet_onboarding.pan),
       contact_number  = COALESCE(EXCLUDED.contact_number,fleet_onboarding.contact_number),
       contact_email   = COALESCE(EXCLUDED.contact_email, fleet_onboarding.contact_email),
       city            = COALESCE(EXCLUDED.city,          fleet_onboarding.city),
       state           = COALESCE(EXCLUDED.state,         fleet_onboarding.state),
       address         = COALESCE(EXCLUDED.address,       fleet_onboarding.address),
       country         = COALESCE(EXCLUDED.country,       fleet_onboarding.country),
       fleet_size      = COALESCE(EXCLUDED.fleet_size,    fleet_onboarding.fleet_size),
       industry_type   = COALESCE(EXCLUDED.industry_type, fleet_onboarding.industry_type)
      RETURNING *;
    `;
    const values = [
      uid, company_name, gstin, pan, contact_number, contact_email, city, state, address, country, fleet_size, industry_type
    ];
  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateLastPromptedAt = async (uid) => {
  await pool.query(`UPDATE users SET last_prompted_at=CURRENT_TIMESTAMP WHERE uid=$1`, [uid]);
};

module.exports = { syncUser, getProfileAndOrg, updateProfile, updateOrganization, updateLastPromptedAt };
