// config/dbconfig.js
// Moved from backend/dbconfig.js
// Load environment variables early so callers that require this file
// pick up `DATABASE_URL` and other settings from backend/.env
require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL 
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: Number(process.env.PG_POOL_MAX) || 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 })
  : new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DATABASE || 'dravyantra',
      password: process.env.PG_PASSWORD || 'postgres',
      port: process.env.PG_PORT || 5432,
      max: Number(process.env.PG_POOL_MAX) || 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

// Guard against unexpected errors on idle clients so they don't crash the process
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle Postgres client', err);
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
        trip_completed BOOLEAN DEFAULT FALSE,
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
        default_mileage DOUBLE PRECISION DEFAULT 4.0,
        current_mileage DOUBLE PRECISION DEFAULT 0.0,
        fuel_saved DOUBLE PRECISION DEFAULT 0.0,
        fuel_wasted DOUBLE PRECISION DEFAULT 0.0,
        money_saved DOUBLE PRECISION DEFAULT 0.0,
        money_wasted DOUBLE PRECISION DEFAULT 0.0,
        theft_fuel_loss DOUBLE PRECISION DEFAULT 0.0,
        theft_money_loss DOUBLE PRECISION DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
      // Ensure new columns exist on existing tables
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_completed BOOLEAN DEFAULT FALSE;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS default_mileage DOUBLE PRECISION DEFAULT 4.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS current_mileage DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_saved DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_wasted DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS money_saved DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS money_wasted DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS live_idle_speed DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS live_idle_time VARCHAR DEFAULT '00:00:00';`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS total_idle_time INTEGER DEFAULT 0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS idle_money_wasted DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_price DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS live_fuel_count DOUBLE PRECISION DEFAULT 0.0;`);
      // New column to store per-trip speeding fuel wasted (liters)
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS speeding_fuel_wasted DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS theft_fuel_loss DOUBLE PRECISION DEFAULT 0.0;`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS theft_money_loss DOUBLE PRECISION DEFAULT 0.0;`);
      // Backfill speeding_fuel_wasted from the row's current_mileage and trip distance.
      await client.query(`UPDATE trips
        SET speeding_fuel_wasted = CASE
          WHEN current_mileage IS NULL OR current_mileage <= 0 OR current_mileage >= 3.5 OR COALESCE(distance, 0) <= 0 THEN 0.0
          ELSE ROUND(GREATEST((COALESCE(distance, 0) / current_mileage) - (COALESCE(distance, 0) / 3.5), 0.0)::numeric, 2)
        END;`);
      await client.query(`
        CREATE OR REPLACE FUNCTION notify_trip_update() RETURNS trigger AS $$
        DECLARE
          payload JSON;
        BEGIN
          payload := json_build_object(
            'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
            'new', row_to_json(NEW)
          );
          PERFORM pg_notify('trip_updates', payload::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await client.query(`DROP TRIGGER IF EXISTS trg_notify_trip_update ON trips;`);
      await client.query(`CREATE TRIGGER trg_notify_trip_update AFTER INSERT OR UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION notify_trip_update();`);
      // Keep live-speed driven calculations in sync at the database layer as well.
      await client.query(`
        CREATE OR REPLACE FUNCTION compute_idle_money_wasted()
        RETURNS trigger AS $$
        DECLARE
          baseline_mileage CONSTANT DOUBLE PRECISION := 3.5;
          baseline_fuel DOUBLE PRECISION;
          actual_fuel DOUBLE PRECISION;
          fuel_price DOUBLE PRECISION;
          mileage_fuel_wasted DOUBLE PRECISION;
          idle_fuel_wasted DOUBLE PRECISION;
          speeding_fuel_wasted DOUBLE PRECISION;
        BEGIN
          NEW.current_mileage := CASE
            WHEN COALESCE(NEW.live_speed, 0) >= 40 AND NEW.live_speed < 60 THEN 4.38
            WHEN COALESCE(NEW.live_speed, 0) < 70 THEN 3.5
            WHEN NEW.live_speed < 80 THEN 3.15
            WHEN NEW.live_speed < 90 THEN 2.98
            WHEN NEW.live_speed < 100 THEN 2.8
            WHEN NEW.live_speed < 110 THEN 2.63
            WHEN NEW.live_speed < 120 THEN 2.45
            ELSE 2.28
          END;

          NEW.fuel_used := CASE
            WHEN COALESCE(NEW.distance, 0) > 0 AND NEW.current_mileage > 0 THEN ROUND((NEW.distance / NEW.current_mileage)::numeric, 2)
            ELSE 0.0
          END;

          baseline_fuel := CASE
            WHEN COALESCE(NEW.distance, 0) > 0 THEN ROUND((NEW.distance / baseline_mileage)::numeric, 2)
            ELSE 0.0
          END;
          actual_fuel := COALESCE(NEW.fuel_used, 0.0);

          NEW.fuel_saved := CASE
            WHEN NEW.current_mileage > baseline_mileage AND baseline_fuel > actual_fuel THEN ROUND((baseline_fuel - actual_fuel)::numeric, 2)
            ELSE 0.0
          END;

          fuel_price := COALESCE(NEW.fuel_price_per_liter, 100.0);
          NEW.money_saved := CASE
            WHEN NEW.fuel_saved > 0 THEN ROUND((NEW.fuel_saved * fuel_price)::numeric, 2)
            ELSE 0.0
          END;

          NEW.idle_money_wasted := ROUND(COALESCE(NEW.total_idle_time, 0) * 1.7::numeric, 2);

          mileage_fuel_wasted := CASE
            WHEN NEW.current_mileage < baseline_mileage THEN ROUND((actual_fuel - baseline_fuel)::numeric, 2)
            ELSE 0.0
          END;

          idle_fuel_wasted := CASE
            WHEN fuel_price > 0 THEN ROUND((NEW.idle_money_wasted / fuel_price)::numeric, 2)
            ELSE 0.0
          END;

          NEW.fuel_wasted := ROUND((mileage_fuel_wasted + idle_fuel_wasted)::numeric, 2);

          speeding_fuel_wasted := CASE
            WHEN NEW.current_mileage IS NULL OR NEW.current_mileage <= 0 OR NEW.current_mileage >= baseline_mileage OR COALESCE(NEW.distance, 0) <= 0 THEN 0.0
            ELSE ROUND(GREATEST((COALESCE(NEW.distance, 0) / NEW.current_mileage) - (COALESCE(NEW.distance, 0) / baseline_mileage), 0.0)::numeric, 2)
          END;
          NEW.speeding_fuel_wasted := speeding_fuel_wasted;

          NEW.money_wasted := ROUND((NEW.fuel_wasted * fuel_price)::numeric, 2);

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      await client.query(`DROP TRIGGER IF EXISTS trips_compute_idle_money_wasted ON trips;`);
      await client.query(`CREATE TRIGGER trips_compute_idle_money_wasted BEFORE INSERT OR UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION compute_idle_money_wasted();`);
      // Create or replace trigger function to keep speeding_fuel_wasted in sync
      await client.query(`
        CREATE OR REPLACE FUNCTION recalc_speeding_fuel_wasted() RETURNS trigger AS $$
        BEGIN
          IF COALESCE(NEW.live_speed, 0) > 0 THEN
            NEW.current_mileage := CASE
              WHEN COALESCE(NEW.live_speed, 0) >= 40 AND NEW.live_speed < 60 THEN 4.38
              WHEN NEW.live_speed < 70 THEN 3.5
              WHEN NEW.live_speed < 80 THEN 3.15
              WHEN NEW.live_speed < 90 THEN 2.98
              WHEN NEW.live_speed < 100 THEN 2.8
              WHEN NEW.live_speed < 110 THEN 2.63
              WHEN NEW.live_speed < 120 THEN 2.45
              ELSE 2.28
            END;
          END IF;

          IF (NEW.current_mileage IS NULL OR NEW.current_mileage <= 0 OR NEW.current_mileage >= 3.5 OR COALESCE(NEW.distance, 0) <= 0) THEN
            NEW.speeding_fuel_wasted = 0.0;
          ELSE
            NEW.speeding_fuel_wasted = ROUND(GREATEST((COALESCE(NEW.distance, 0) / NEW.current_mileage) - (COALESCE(NEW.distance, 0) / 3.5), 0.0)::numeric, 2);
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      // Attach trigger to recalculate when distance/current_mileage/live_speed change
      await client.query(`DROP TRIGGER IF EXISTS trips_recalc_speeding ON trips;`);
      await client.query(`CREATE TRIGGER trips_recalc_speeding BEFORE INSERT OR UPDATE OF distance, current_mileage, live_speed ON trips FOR EACH ROW EXECUTE FUNCTION recalc_speeding_fuel_wasted();`);
      await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
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
