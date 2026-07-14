require('dotenv').config();
const { pool } = require('./dbconfig');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Altering fleet_onboarding table...');
    // Add columns if they don't exist
    const alterQueries = `
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS business_type VARCHAR(100);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS industry VARCHAR(100);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS fleet_size VARCHAR(50);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS owner_email VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS owner_phone VARCHAR(50);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS company_email VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS company_phone VARCHAR(50);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS country VARCHAR(100);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS timezone VARCHAR(100);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS company_logo TEXT;
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS company_registration_number VARCHAR(100);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS website VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS support_email VARCHAR(255);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS support_phone VARCHAR(50);
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS submission_date TIMESTAMP;
      ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `;
    await client.query(alterQueries);

    // Update existing rows to 'Approved' for backward compatibility
    console.log('Updating existing organizations to Approved status...');
    await client.query(`UPDATE fleet_onboarding SET status = 'Approved', profile_completion = 100 WHERE status = 'Draft'`);

    console.log('Creating organization_audit_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_audit_logs (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES fleet_onboarding(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        admin_id VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
