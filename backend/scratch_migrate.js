require('dotenv').config();
const { pool } = require('./config/dbconfig');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Add new columns to users table if they don't exist
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(255),
      ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"emailNotifications": true, "criticalAlerts": true, "supportTicketNotifications": true, "platformAnnouncements": true, "weeklySummary": true, "monthlySummary": true, "maintenanceNotifications": true}'::jsonb;
    `);

    // Create admin_sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id SERIAL PRIMARY KEY,
        admin_uid VARCHAR(100) NOT NULL,
        session_token TEXT NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        os VARCHAR(50),
        browser VARCHAR(50),
        device VARCHAR(50),
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        CONSTRAINT fk_admin_session_user FOREIGN KEY (admin_uid) REFERENCES users (uid) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_uid ON admin_sessions(admin_uid);
      CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
