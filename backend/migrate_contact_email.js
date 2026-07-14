const db = require('./config/dbconfig');

async function migrate() {
  try {
    console.log('Running migration...');
    const client = await db.pool.connect();
    await client.query('ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);');
    console.log('Migration successful: Added contact_email to fleet_onboarding.');
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
