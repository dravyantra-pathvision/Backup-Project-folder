// config/dbconfig.js
require('dotenv').config();
const { Pool } = require('pg');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: Number(process.env.PG_POOL_MAX) || 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 })
  : new Pool({
      user: process.env.PG_USER || 'postgres',
      host: process.env.PG_HOST || 'localhost',
      database: process.env.PG_DATABASE || 'dravyantra',
      password: process.env.PG_PASSWORD || 'postgres',
      port: Number(process.env.PG_PORT) || 5432,
      max: Number(process.env.PG_POOL_MAX) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    // ── USERS ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(128) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'fleet_owner',
        phone VARCHAR(50),
        timezone VARCHAR(50),
        speed_limit_override INTEGER,
        fuel_theft_limit_override DOUBLE PRECISION,
        employee_id VARCHAR(100),
        department VARCHAR(100),
        language_pref VARCHAR(50) DEFAULT 'English',
        email_notif BOOLEAN DEFAULT TRUE,
        sms_notif BOOLEAN DEFAULT FALSE,
        push_notif BOOLEAN DEFAULT TRUE,
        last_prompted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── FLEET ONBOARDING ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet_onboarding (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        company_name VARCHAR(255) NOT NULL,
        gstin VARCHAR(50),
        pan VARCHAR(50),
        contact_number VARCHAR(50),
        city VARCHAR(100),
        state VARCHAR(100),
        address TEXT,
        pincode VARCHAR(20),
        country VARCHAR(100) DEFAULT 'India',
        fleet_size VARCHAR(50),
        industry_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uid)
      );
    `);

    // ── VEHICLES ────────────────────────────────────────────────────────────
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
        rc_url TEXT,
        insurance_url TEXT,
        puc_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE vehicles DROP COLUMN IF EXISTS image_url;`);

    // ── DRIVERS ─────────────────────────────────────────────────────────────
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
        image_url TEXT,
        aadhar_url TEXT,
        license_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS aadhar_url TEXT;`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS license_url TEXT;`);

    // ── FUEL LOGS ───────────────────────────────────────────────────────────
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

    // ── TRIPS ───────────────────────────────────────────────────────────────
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
        eway_bill_url TEXT,
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
        idle_money_wasted DOUBLE PRECISION DEFAULT 0.0,
        fuel_price DOUBLE PRECISION DEFAULT 0.0,
        fuel_price_per_liter DOUBLE PRECISION DEFAULT 100.0,
        live_idle_speed DOUBLE PRECISION DEFAULT 0.0,
        live_idle_time VARCHAR DEFAULT '00:00:00',
        total_idle_time INTEGER DEFAULT 0,
        live_fuel_count DOUBLE PRECISION DEFAULT 0.0,
        speeding_fuel_wasted DOUBLE PRECISION DEFAULT 0.0,
        theft_fuel_loss DOUBLE PRECISION DEFAULT 0.0,
        theft_money_loss DOUBLE PRECISION DEFAULT 0.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS eway_bill_url TEXT;`);

    // ── FLEET SETTINGS ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fleet_settings (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE UNIQUE,
        speed_threshold INTEGER DEFAULT 80,
        fuel_drop_threshold DOUBLE PRECISION DEFAULT 5.0,
        idle_limit INTEGER DEFAULT 15,
        fastag_threshold INTEGER DEFAULT 500,
        mileage_threshold DOUBLE PRECISION DEFAULT 4.0,
        whatsapp_enabled BOOLEAN DEFAULT TRUE,
        sms_enabled BOOLEAN DEFAULT FALSE,
        push_enabled BOOLEAN DEFAULT TRUE,
        email_enabled BOOLEAN DEFAULT TRUE,
        per_type_toggles JSONB DEFAULT '{"overSpeed":true,"excessIdle":true,"fuelDrop":true,"geoFence":true,"harshBraking":true,"eWayBill":true,"fastag":true,"gpsLost":true}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── ALERTS ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        trip_id VARCHAR(50),
        vehicle_plate VARCHAR(50),
        driver VARCHAR(255),
        type VARCHAR(100),
        message TEXT,
        severity VARCHAR(20) DEFAULT 'warning',
        category VARCHAR(50) DEFAULT 'fuel',
        status VARCHAR(20) DEFAULT 'pending',
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_uid ON alerts(uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);`);

    // ── REPORT SCHEDULES ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS report_schedules (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        report_type VARCHAR(100) NOT NULL,
        frequency VARCHAR(50) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        recipient VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        last_sent_at TIMESTAMP,
        next_send_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── MIGRATIONS: Add missing columns to existing tables ──────────────────
    // users
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS speed_limit_override INTEGER;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fuel_theft_limit_override DOUBLE PRECISION;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language_pref VARCHAR(50) DEFAULT 'English';`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notif BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notif BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notif BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_prompted_at TIMESTAMP;`);

    // fleet_onboarding
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS pan VARCHAR(50);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS address TEXT;`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS fleet_size VARCHAR(50);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100);`);

    // vehicles
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rc_url TEXT;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_url TEXT;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS puc_url TEXT;`);

    // trips
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
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_price_per_liter DOUBLE PRECISION DEFAULT 100.0;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS live_fuel_count DOUBLE PRECISION DEFAULT 0.0;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS speeding_fuel_wasted DOUBLE PRECISION DEFAULT 0.0;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS theft_fuel_loss DOUBLE PRECISION DEFAULT 0.0;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS theft_money_loss DOUBLE PRECISION DEFAULT 0.0;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);

    // ── DB FUNCTIONS & TRIGGERS ─────────────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION notify_trip_update() RETURNS trigger AS $$
      DECLARE payload JSON;
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

    await client.query(`
      CREATE OR REPLACE FUNCTION compute_trip_metrics()
      RETURNS trigger AS $$
      DECLARE
        baseline_mileage CONSTANT DOUBLE PRECISION := 3.5;
        baseline_fuel DOUBLE PRECISION;
        actual_fuel DOUBLE PRECISION;
        fprice DOUBLE PRECISION;
        mileage_fuel_wasted DOUBLE PRECISION;
        idle_fuel_wasted DOUBLE PRECISION;
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
          WHEN COALESCE(NEW.distance, 0) > 0 AND NEW.current_mileage > 0
            THEN ROUND((NEW.distance / NEW.current_mileage)::numeric, 2)
          ELSE 0.0
        END;

        baseline_fuel := CASE
          WHEN COALESCE(NEW.distance, 0) > 0
            THEN ROUND((NEW.distance / baseline_mileage)::numeric, 2)
          ELSE 0.0
        END;
        actual_fuel := COALESCE(NEW.fuel_used, 0.0);

        NEW.fuel_saved := CASE
          WHEN NEW.current_mileage > baseline_mileage AND baseline_fuel > actual_fuel
            THEN ROUND((baseline_fuel - actual_fuel)::numeric, 2)
          ELSE 0.0
        END;

        fprice := GREATEST(COALESCE(NEW.fuel_price_per_liter, COALESCE(NEW.fuel_price, 100.0)), 1.0);
        NEW.money_saved := CASE
          WHEN NEW.fuel_saved > 0 THEN ROUND((NEW.fuel_saved * fprice)::numeric, 2)
          ELSE 0.0
        END;

        NEW.idle_money_wasted := ROUND(COALESCE(NEW.total_idle_time, 0) * 1.7::numeric, 2);

        mileage_fuel_wasted := CASE
          WHEN NEW.current_mileage < baseline_mileage
            THEN GREATEST(ROUND((actual_fuel - baseline_fuel)::numeric, 2), 0.0)
          ELSE 0.0
        END;

        idle_fuel_wasted := CASE
          WHEN fprice > 0 THEN ROUND((NEW.idle_money_wasted / fprice)::numeric, 2)
          ELSE 0.0
        END;

        NEW.fuel_wasted := ROUND((mileage_fuel_wasted + idle_fuel_wasted)::numeric, 2);

        NEW.speeding_fuel_wasted := CASE
          WHEN NEW.current_mileage IS NULL OR NEW.current_mileage <= 0
               OR NEW.current_mileage >= baseline_mileage OR COALESCE(NEW.distance, 0) <= 0
            THEN 0.0
          ELSE ROUND(GREATEST((NEW.distance / NEW.current_mileage) - (NEW.distance / baseline_mileage), 0.0)::numeric, 2)
        END;

        NEW.money_wasted := ROUND((NEW.fuel_wasted * fprice)::numeric, 2);
        NEW.updated_at := CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS trips_compute_metrics ON trips;`);
    await client.query(`CREATE TRIGGER trips_compute_metrics BEFORE INSERT OR UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION compute_trip_metrics();`);

    // ── SEED: ensure default_user exists ────────────────────────────────────
    await client.query(`
      INSERT INTO users (uid, email, full_name, role)
      VALUES ('default_user', 'default@example.com', 'Default User', 'fleet_owner')
      ON CONFLICT (uid) DO NOTHING;
    `);

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message || err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
