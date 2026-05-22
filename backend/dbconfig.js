const { Pool } = require('pg');

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DATABASE || 'dravyantra',
      password: process.env.PG_PASSWORD || 'postgres',
      port: process.env.PG_PORT || 5432,
    });

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(128) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'fleet_owner',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet_onboarding (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        gstin VARCHAR(50),
        contact_number VARCHAR(50),
        city VARCHAR(100),
        state VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uid)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        plate VARCHAR(50) PRIMARY KEY,
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
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id VARCHAR(50) PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        age INTEGER,
        exp INTEGER,
        lic VARCHAR(100),
        lic_exp VARCHAR(50),
        blood VARCHAR(10),
        vehicle VARCHAR(50),
        status VARCHAR(50),
        score INTEGER,
        mil DOUBLE PRECISION,
        idle DOUBLE PRECISION,
        trips INTEGER,
        harsh INTEGER,
        over_speed INTEGER,
        deviation INTEGER,
        fuel_eff INTEGER,
        rating DOUBLE PRECISION,
        home VARCHAR(255),
        on_leave BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        trip_history JSONB DEFAULT '[]',
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_logs (
        id VARCHAR(50) PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        vehicle VARCHAR(50),
        driver VARCHAR(255),
        station VARCHAR(255),
        liters DOUBLE PRECISION,
        rate DOUBLE PRECISION,
        cost DOUBLE PRECISION,
        odometer INTEGER,
        date VARCHAR(50),
        is_suspect BOOLEAN DEFAULT FALSE,
        suspect_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id VARCHAR(50) PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        vehicle VARCHAR(50),
        driver VARCHAR(255),
        from_location VARCHAR(255),
        to_location VARCHAR(255),
        load VARCHAR(255),
        client VARCHAR(255),
        status VARCHAR(50) DEFAULT 'not started',
        eway_bill VARCHAR(100),
        date VARCHAR(50),
        progress DOUBLE PRECISION DEFAULT 0.0,
        distance DOUBLE PRECISION DEFAULT 0.0,
        fuel_used DOUBLE PRECISION DEFAULT 0.0,
        score DOUBLE PRECISION DEFAULT 0.0,
        delay_minutes INTEGER DEFAULT 0,
        waypoints JSONB DEFAULT '[]',
        toll_count INTEGER DEFAULT 0,
        live_speed DOUBLE PRECISION DEFAULT 0.0,
        power BOOLEAN DEFAULT FALSE,
        idle_duration INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Ensure default_user exists so FK constraints are satisfied
    await client.query(`
      INSERT INTO users (uid, email, full_name, role)
      VALUES ('default_user', 'default@example.com', 'Default User', 'fleet_owner')
      ON CONFLICT (uid) DO NOTHING;
    `);
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Error initializing database:", err);
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
