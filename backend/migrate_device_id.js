const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'dravyantra',
  password: process.env.PG_PASSWORD || 'password',
  port: process.env.PG_PORT || 5432,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Renaming old vehicles table...');
    await client.query('ALTER TABLE vehicles RENAME TO vehicles_old');
    
    console.log('Creating new vehicles table...');
    await client.query(`
      CREATE TABLE vehicles (
        plate VARCHAR(50) PRIMARY KEY,
        device_id VARCHAR(100) UNIQUE,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        model VARCHAR(255),
        year INTEGER,
        type VARCHAR(100),
        status VARCHAR(50),
        driver VARCHAR(255),
        loc VARCHAR(255),
        speed INTEGER,
        fuel DOUBLE PRECISION,
        mil DOUBLE PRECISION,
        idle DOUBLE PRECISION,
        fastag INTEGER,
        health INTEGER,
        odo INTEGER,
        next_service VARCHAR(50),
        insurance VARCHAR(50),
        permit VARCHAR(50),
        puc VARCHAR(50),
        last_fill VARCHAR(50),
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        route JSONB DEFAULT '[]',
        alerts JSONB DEFAULT '[]',
        service_history JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT TRUE,
        is_blacklisted BOOLEAN DEFAULT FALSE,
        rc_url TEXT,
        insurance_url TEXT,
        puc_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Copying data...');
    // We need to copy all columns. To be safe, we list them explicitly so order doesn't matter.
    await client.query(`
      INSERT INTO vehicles (
        plate, device_id, uid, model, year, type, status, driver, loc, speed, fuel, mil, idle, 
        fastag, health, odo, next_service, insurance, permit, puc, last_fill, lat, lng, route, 
        alerts, service_history, is_active, is_blacklisted, rc_url, insurance_url, puc_url, created_at
      )
      SELECT 
        plate, device_id, uid, model, year, type, status, driver, loc, speed, fuel, mil, idle, 
        fastag, health, odo, next_service, insurance, permit, puc, last_fill, lat, lng, route, 
        alerts, service_history, is_active, is_blacklisted, rc_url, insurance_url, puc_url, created_at
      FROM vehicles_old;
    `);

    console.log('Dropping old table...');
    await client.query('DROP TABLE vehicles_old CASCADE');
    
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
