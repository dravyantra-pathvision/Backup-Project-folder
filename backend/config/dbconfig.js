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
        idle_duration_override INTEGER,
        low_mileage_override DOUBLE PRECISION,
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
        contact_email VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        address TEXT,
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
        vibration DOUBLE PRECISION DEFAULT 0.0,
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

    // ── VEHICLE BASELINES ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_baselines (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        vehicle_id VARCHAR(50) NOT NULL,
        baseline_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        baseline_end_date TIMESTAMP,
        baseline_duration_days INTEGER DEFAULT 7,
        baseline_distance DOUBLE PRECISION DEFAULT 0.0,
        baseline_fuel_consumed DOUBLE PRECISION DEFAULT 0.0,
        baseline_efficiency DOUBLE PRECISION DEFAULT 4.0,
        baseline_idle_hours DOUBLE PRECISION DEFAULT 0.0,
        baseline_idle_fuel DOUBLE PRECISION DEFAULT 0.0,
        baseline_overspeed_events INTEGER DEFAULT 0,
        baseline_status VARCHAR(50) DEFAULT 'collecting',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uid, vehicle_id)
      );
    `);

    // ── FUEL LOSS EVENTS ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fuel_loss_events (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        vehicle_id VARCHAR(50) NOT NULL,
        fuel_before DOUBLE PRECISION DEFAULT 0.0,
        fuel_after DOUBLE PRECISION DEFAULT 0.0,
        loss_liters DOUBLE PRECISION DEFAULT 0.0,
        loss_rupees DOUBLE PRECISION DEFAULT 0.0,
        engine_status VARCHAR(50) DEFAULT 'OFF',
        vehicle_speed INTEGER DEFAULT 0,
        event_status VARCHAR(50) DEFAULT 'detected',
        is_prevented BOOLEAN DEFAULT FALSE,
        event_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── MONTHLY SAVINGS WALLET SNAPSHOTS ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_savings_wallet (
        id SERIAL PRIMARY KEY,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        month_year VARCHAR(7) NOT NULL,
        verified_savings_liters DOUBLE PRECISION DEFAULT 0.0,
        verified_savings_rupees DOUBLE PRECISION DEFAULT 0.0,
        prevented_loss_liters DOUBLE PRECISION DEFAULT 0.0,
        prevented_loss_rupees DOUBLE PRECISION DEFAULT 0.0,
        prevented_events INTEGER DEFAULT 0,
        identified_waste_liters DOUBLE PRECISION DEFAULT 0.0,
        identified_waste_rupees DOUBLE PRECISION DEFAULT 0.0,
        idle_waste_liters DOUBLE PRECISION DEFAULT 0.0,
        idle_waste_rupees DOUBLE PRECISION DEFAULT 0.0,
        speeding_waste_liters DOUBLE PRECISION DEFAULT 0.0,
        speeding_waste_rupees DOUBLE PRECISION DEFAULT 0.0,
        speeding_events INTEGER DEFAULT 0,
        theft_waste_liters DOUBLE PRECISION DEFAULT 0.0,
        theft_waste_rupees DOUBLE PRECISION DEFAULT 0.0,
        theft_events INTEGER DEFAULT 0,
        vehicle_breakdown JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'in_progress',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(uid, month_year)
      );
    `);

    // ── DEVICES (IoT Management) ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        device_id VARCHAR(255) PRIMARY KEY,
        serial_number VARCHAR(255),
        qr_code TEXT,
        firmware_version VARCHAR(255),
        hardware_version VARCHAR(255),
        device_type VARCHAR(255),
        manufacturer VARCHAR(255),
        mac_address VARCHAR(255),
        imei VARCHAR(255),
        sim_number VARCHAR(255),
        gps_module VARCHAR(255),
        fuel_sensor VARCHAR(255),
        accelerometer BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'Available',
        assigned_vehicle VARCHAR(50) REFERENCES vehicles(plate) ON DELETE SET NULL,
        assigned_organization VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        last_heartbeat TIMESTAMP,
        last_communication TIMESTAMP,
        battery_level INTEGER,
        signal_strength INTEGER,
        gps_status VARCHAR(50),
        created_by VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── DEVICE AUDIT LOGS ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS device_audit_logs (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) REFERENCES devices(device_id) ON DELETE CASCADE,
        admin_uid VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        fleet_owner_uid VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_device_logs_device_id ON device_audit_logs(device_id);`);

    // ── SYSTEM AUDIT LOGS ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_audit_logs (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_uid VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        org_uid VARCHAR(128),
        module VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        ip_address VARCHAR(45),
        browser TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sys_audit_user ON system_audit_logs(user_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sys_audit_org ON system_audit_logs(org_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sys_audit_module ON system_audit_logs(module);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sys_audit_ts ON system_audit_logs(timestamp);`);

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
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS idle_duration_override INTEGER;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS low_mileage_override DOUBLE PRECISION;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language_pref VARCHAR(50) DEFAULT 'English';`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notif BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_notif BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notif BOOLEAN DEFAULT TRUE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_prompted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);`);

    // fleet_onboarding
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS pan VARCHAR(50);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS address TEXT;`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'India';`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS fleet_size VARCHAR(50);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS industry_type VARCHAR(100);`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);`);

    // vehicles
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rc_url TEXT;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_url TEXT;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS puc_url TEXT;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS make VARCHAR(255);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS model VARCHAR(255);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(50);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_capacity DOUBLE PRECISION;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vibration DOUBLE PRECISION DEFAULT 0.0;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin VARCHAR(100);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_number VARCHAR(100);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS chassis_number VARCHAR(100);`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rc_expiry DATE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS insurance_expiry DATE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS puc_expiry DATE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fitness_expiry DATE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);`);

    // drivers
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);`);

    // trips
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50);`);

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

    // fleet_settings columns
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS fuel_price_per_liter DOUBLE PRECISION DEFAULT 92.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS co2_factor_per_liter DOUBLE PRECISION DEFAULT 2.68;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS gps_drift_threshold_km DOUBLE PRECISION DEFAULT 0.05;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS fuel_noise_threshold_liters DOUBLE PRECISION DEFAULT 1.5;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS fuel_refill_threshold_liters DOUBLE PRECISION DEFAULT 5.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS fuel_theft_threshold_liters DOUBLE PRECISION DEFAULT 3.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS overspeed_threshold_kmh DOUBLE PRECISION DEFAULT 80.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS idle_warning_seconds INTEGER DEFAULT 300;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS idle_critical_seconds INTEGER DEFAULT 600;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS harsh_brake_delta_kmh DOUBLE PRECISION DEFAULT 10.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS rapid_accel_delta_kmh DOUBLE PRECISION DEFAULT 10.0;`);
    await client.query(`ALTER TABLE fleet_settings ADD COLUMN IF NOT EXISTS heartbeat_timeout_seconds INTEGER DEFAULT 60;`);

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
        dist_delta DOUBLE PRECISION := 0.0;
        fuel_used_delta DOUBLE PRECISION := 0.0;
        baseline_fuel_delta DOUBLE PRECISION := 0.0;
        speeding_wasted_delta DOUBLE PRECISION := 0.0;
        baseline_mileage DOUBLE PRECISION;
        idle_threshold_mins DOUBLE PRECISION;
        idle_threshold_secs DOUBLE PRECISION;
        fprice DOUBLE PRECISION;
        idle_fuel_wasted DOUBLE PRECISION;
        idle_time_above_thresh DOUBLE PRECISION;
      BEGIN
        -- If trip is not started or created, clear metrics (for reset)
        IF NEW.status = 'not started' OR NEW.status = 'created' OR (COALESCE(NEW.distance, 0) = 0 AND COALESCE(NEW.fuel_used, 0) = 0 AND COALESCE(NEW.theft_fuel_loss, 0) = 0 AND TG_OP = 'UPDATE' AND COALESCE(OLD.distance, 0) = 0) THEN
          NEW.distance := 0.0;
          NEW.fuel_used := 0.0;
          NEW.fuel_saved := 0.0;
          NEW.fuel_wasted := 0.0;
          NEW.money_saved := 0.0;
          NEW.money_wasted := 0.0;
          NEW.idle_money_wasted := 0.0;
          NEW.total_idle_time := COALESCE(NEW.total_idle_time, 0);
          NEW.live_speed := COALESCE(NEW.live_speed, 0.0);
          NEW.progress := 0.0;
          NEW.speeding_fuel_wasted := 0.0;
          NEW.current_mileage := 0.0;
          NEW.theft_fuel_loss := 0.0;
          NEW.theft_money_loss := 0.0;
          NEW.updated_at := CURRENT_TIMESTAMP;
          RETURN NEW;
        END IF;

        -- Dynamically load fleet owner settings from fleet_settings table
        SELECT 
          COALESCE(u.low_mileage_override, fs.mileage_threshold, 4.0),
          COALESCE(u.idle_duration_override, fs.idle_warning_seconds / 60.0, fs.idle_limit, 3.0),
          COALESCE(fs.fuel_price_per_liter, 100.0)
        INTO baseline_mileage, idle_threshold_mins, fprice
        FROM users u 
        LEFT JOIN fleet_settings fs ON u.uid = NEW.uid 
        WHERE u.uid = NEW.uid;

        -- Fallbacks in case user or settings row doesn't exist
        IF baseline_mileage IS NULL OR baseline_mileage <= 0 THEN baseline_mileage := 4.0; END IF;
        IF idle_threshold_mins IS NULL OR idle_threshold_mins <= 0 THEN idle_threshold_mins := 3.0; END IF;
        IF fprice IS NULL OR fprice <= 0 THEN fprice := 100.0; END IF;

        -- Set trip fuel price snapshot
        IF NEW.fuel_price_per_liter IS NULL OR NEW.fuel_price_per_liter <= 0 THEN
          NEW.fuel_price_per_liter := fprice;
        ELSE
          fprice := NEW.fuel_price_per_liter;
        END IF;

        -- Speed-dependent degraded mileage curve
        NEW.current_mileage := CASE
          WHEN COALESCE(NEW.live_speed, 0) >= 40 AND NEW.live_speed < 60 THEN 4.38
          WHEN COALESCE(NEW.live_speed, 0) < 70 THEN baseline_mileage
          WHEN NEW.live_speed < 80 THEN 3.15
          WHEN NEW.live_speed < 90 THEN 2.98
          WHEN NEW.live_speed < 100 THEN 2.80
          WHEN NEW.live_speed < 110 THEN 2.63
          WHEN NEW.live_speed < 120 THEN 2.45
          ELSE 2.28
        END;

        -- Distance delta since last packet
        IF TG_OP = 'UPDATE' THEN
          dist_delta := GREATEST(0.0, COALESCE(NEW.distance, 0.0) - COALESCE(OLD.distance, 0.0));
        ELSE
          dist_delta := GREATEST(0.0, COALESCE(NEW.distance, 0.0));
        END IF;

        -- ACCUMULATION LOGIC:
        -- 1. Ensure theft_fuel_loss is strictly cumulative & non-decreasing
        IF TG_OP = 'UPDATE' THEN
          NEW.theft_fuel_loss := GREATEST(COALESCE(NEW.theft_fuel_loss, 0.0), COALESCE(OLD.theft_fuel_loss, 0.0));
        ELSE
          NEW.theft_fuel_loss := COALESCE(NEW.theft_fuel_loss, 0.0);
        END IF;
        NEW.theft_money_loss := ROUND((NEW.theft_fuel_loss * fprice)::numeric, 2);

        -- 2. Accumulate incremental deltas for distance, fuel_used, speeding_fuel_wasted & fuel_saved
        IF dist_delta > 0 AND NEW.current_mileage > 0 THEN
          fuel_used_delta       := dist_delta / NEW.current_mileage;
          baseline_fuel_delta   := dist_delta / baseline_mileage;
          speeding_wasted_delta := GREATEST(0.0, fuel_used_delta - baseline_fuel_delta);

          IF TG_OP = 'UPDATE' THEN
            NEW.fuel_used            := ROUND((GREATEST(COALESCE(OLD.fuel_used, 0.0), COALESCE(NEW.fuel_used, 0.0)) + fuel_used_delta)::numeric, 2);
            NEW.speeding_fuel_wasted := ROUND((COALESCE(OLD.speeding_fuel_wasted, 0.0) + speeding_wasted_delta)::numeric, 2);
            IF NEW.current_mileage > baseline_mileage THEN
              NEW.fuel_saved         := ROUND((COALESCE(OLD.fuel_saved, 0.0) + (baseline_fuel_delta - fuel_used_delta))::numeric, 2);
            ELSE
              NEW.fuel_saved         := COALESCE(OLD.fuel_saved, 0.0);
            END IF;
          ELSE
            NEW.fuel_used            := ROUND(fuel_used_delta::numeric, 2);
            NEW.speeding_fuel_wasted := ROUND(speeding_wasted_delta::numeric, 2);
            NEW.fuel_saved           := CASE WHEN NEW.current_mileage > baseline_mileage THEN ROUND((baseline_fuel_delta - fuel_used_delta)::numeric, 2) ELSE 0.0 END;
          END IF;
        ELSE
          IF TG_OP = 'UPDATE' THEN
            NEW.fuel_used            := GREATEST(COALESCE(NEW.fuel_used, 0.0), COALESCE(OLD.fuel_used, 0.0));
            NEW.speeding_fuel_wasted := GREATEST(COALESCE(NEW.speeding_fuel_wasted, 0.0), COALESCE(OLD.speeding_fuel_wasted, 0.0));
            NEW.fuel_saved           := GREATEST(COALESCE(NEW.fuel_saved, 0.0), COALESCE(OLD.fuel_saved, 0.0));
          END IF;
        END IF;

        NEW.money_saved := ROUND((NEW.fuel_saved * fprice)::numeric, 2);

        -- 3. Idle Waste: Calculate ONLY on idle seconds exceeding owner's configured idle threshold
        idle_threshold_secs    := idle_threshold_mins * 60.0;
        idle_time_above_thresh := GREATEST(COALESCE(NEW.total_idle_time, 0) - idle_threshold_secs, 0.0);
        NEW.idle_money_wasted  := ROUND((idle_time_above_thresh * (0.08 * (fprice / 100.0)))::numeric, 2);

        idle_fuel_wasted := CASE
          WHEN fprice > 0 THEN ROUND((NEW.idle_money_wasted / fprice)::numeric, 2)
          ELSE 0.0
        END;

        -- 4. Total fuel wasted = speeding fuel wasted + idle fuel wasted + theft fuel loss
        NEW.fuel_wasted := ROUND((NEW.speeding_fuel_wasted + idle_fuel_wasted + NEW.theft_fuel_loss)::numeric, 2);

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

    // ── ALERT MIGRATIONS: extend alerts table ───────────────────────────────
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS admin_notes TEXT;`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(128);`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'telemetry';`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS telemetry_snapshot JSONB DEFAULT '{}';`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS notified_fleet_owner BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);

    // Migrate old 'pending' status to 'New'
    await client.query(`UPDATE alerts SET status = 'New' WHERE status = 'pending';`);

    // ── RECYCLE BIN MIGRATIONS: Add soft delete flags to core entities ───────
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE fleet_onboarding ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;`);
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;`);

    // ── ALERT AUDIT LOG ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_audit_log (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
        admin_uid VARCHAR(128),
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_audit_logs (
        id SERIAL PRIMARY KEY,
        vehicle_plate VARCHAR(50) REFERENCES vehicles(plate) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        reason TEXT,
        remarks TEXT,
        admin_id VARCHAR(128),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Migrate: if old broken table (with vehicle_id INTEGER FK) exists, drop and recreate
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'vehicle_audit_logs' AND column_name = 'vehicle_id'
        ) THEN
          DROP TABLE vehicle_audit_logs CASCADE;
          CREATE TABLE vehicle_audit_logs (
            id SERIAL PRIMARY KEY,
            vehicle_plate VARCHAR(50) REFERENCES vehicles(plate) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            reason TEXT,
            remarks TEXT,
            admin_id VARCHAR(128),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        END IF;
      END $$;
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vehicle_audit_plate ON vehicle_audit_logs(vehicle_plate);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alert_audit_alert_id ON alert_audit_log(alert_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_detected_at ON alerts(detected_at);`);

    // ── SEED DEFAULT DEVICES ──────────────────────────────────────────────────
    const deviceCountRes = await client.query('SELECT COUNT(*) FROM devices');
    if (parseInt(deviceCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding default devices...');
      const seedDevices = [
        ['123', 'SN1234567890', 'v1.0.0', 'v1.0.0', 'GPS Tracker', 'Teltonika', '00:1A:2B:3C:4D:5E', '861000000000001', '+919999999991', 'GPS-MT-01', 'FuelSens-A', true, 'Assigned', 'KA 12 D 1236', '7dLwA1Lvf3RuL81l8aS6X3BSqH63'],
        ['ffcch', 'SN1234567891', 'v1.0.0', 'v1.0.0', 'GPS Tracker', 'Teltonika', '00:1A:2B:3C:4D:5F', '861000000000002', '+919999999992', 'GPS-MT-01', 'FuelSens-A', true, 'Assigned', 'KA 33 W 1234', 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2'],
        ['DEV-001', 'SN0000000001', 'v1.0.0', 'v1.0.0', 'GPS Tracker', 'CalAmp', '00:1A:2B:3C:4D:60', '861000000000003', '+919999999993', 'GPS-MT-02', 'FuelSens-B', true, 'Available', null, null],
        ['DEV-002', 'SN0000000002', 'v1.0.0', 'v1.0.0', 'OBD Dongle', 'Queclink', '00:1A:2B:3C:4D:61', '861000000000004', '+919999999994', 'GPS-MT-03', 'FuelSens-C', false, 'Available', null, null],
        ['DEV-003', 'SN0000000003', 'v1.0.0', 'v1.0.0', 'Asset Tracker', 'Ruptela', '00:1A:2B:3C:4D:62', '861000000000005', '+919999999995', 'GPS-MT-04', 'FuelSens-D', true, 'Available', null, null]
      ];
      for (const d of seedDevices) {
        d.push(d[0]); // Add device_id as 16th element for qr_code
        await client.query(
          `INSERT INTO devices (
             device_id, serial_number, firmware_version, hardware_version,
             device_type, manufacturer, mac_address, imei, sim_number,
             gps_module, fuel_sensor, accelerometer, status, assigned_vehicle, assigned_organization, qr_code
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          d
        );
      }
      console.log('✅ Devices seeded successfully.');
    }
    // ── SYSTEM SETTINGS ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        category VARCHAR(100) NOT NULL,
        is_sensitive BOOLEAN DEFAULT FALSE,
        requires_super_admin BOOLEAN DEFAULT FALSE,
        description TEXT,
        updated_by VARCHAR(128),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings_history (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) REFERENCES system_settings(key) ON DELETE CASCADE,
        old_value JSONB,
        new_value JSONB NOT NULL,
        changed_by VARCHAR(128),
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_reason TEXT
      );
    `);

    // Seed default settings if empty
    const settingsCount = await client.query('SELECT COUNT(*) FROM system_settings');
    if (parseInt(settingsCount.rows[0].count, 10) === 0) {
      console.log('Seeding default system settings...');
      const defaultSettings = [
        ['platform_name', '"DravYantra"', 'general', false, false, 'Name of the platform'],
        ['logo_url', '""', 'general', false, false, 'URL for the platform logo'],
        ['default_timezone', '"Asia/Kolkata"', 'general', false, false, 'Default timezone for new users'],
        ['default_language', '"en"', 'general', false, false, 'Default language code'],
        ['theme', '"dark"', 'general', false, false, 'Global UI theme (dark/light)'],
        
        ['smtp_host', '"smtp.gmail.com"', 'notifications', false, false, 'SMTP server host'],
        ['smtp_port', '587', 'notifications', false, false, 'SMTP server port'],
        ['smtp_user', '""', 'notifications', false, false, 'SMTP user email'],
        ['smtp_password', '""', 'notifications', true, false, 'SMTP password'],
        ['otp_length', '6', 'notifications', false, false, 'Length of generated OTPs'],
        ['otp_expiry_minutes', '10', 'notifications', false, false, 'OTP expiration time in minutes'],
        
        ['jwt_expiry_hours', '24', 'security', false, false, 'JWT token expiration time in hours'],
        ['session_timeout_minutes', '60', 'security', false, false, 'Web session timeout'],
        ['password_min_length', '8', 'security', false, false, 'Minimum length for passwords'],
        ['password_require_uppercase', 'true', 'security', false, false, 'Require uppercase letter in password'],
        ['password_require_special', 'true', 'security', false, false, 'Require special character in password'],
        ['api_rate_limit_per_minute', '100', 'security', false, false, 'API rate limit per minute per IP'],
        
        ['fuel_theft_threshold_pct', '5.0', 'thresholds', false, false, 'Fuel drop percentage to trigger theft alert'],
        ['overspeed_threshold_kmh', '80', 'thresholds', false, false, 'Speed in km/h to trigger overspeed alert'],
        ['idle_threshold_minutes', '15', 'thresholds', false, false, 'Minutes of idling to trigger alert'],
        ['heartbeat_timeout_minutes', '10', 'thresholds', false, false, 'Minutes without heartbeat to mark device offline'],
        
        ['map_provider', '"openstreetmap"', 'integrations', false, false, 'Maps provider to use (openstreetmap, google)'],
        ['cloud_storage_provider', '"local"', 'integrations', false, false, 'Storage provider (local, s3, gcs)'],
        
        ['maintenance_mode', 'false', 'system', false, false, 'Enable maintenance mode to block non-admin logins'],
        ['audit_logging_enabled', 'true', 'system', false, false, 'Enable global audit logging'],
        ['backup_enabled', 'false', 'system', false, false, 'Enable automated database backups'],
        ['backup_schedule', '"0 2 * * *"', 'system', false, false, 'Cron schedule for database backups']
      ];

      for (const s of defaultSettings) {
        await client.query(
          `INSERT INTO system_settings (key, value, category, is_sensitive, requires_super_admin, description)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          s
        );
      }
      console.log('✅ System settings seeded successfully.');
    }

    // ── SUPPORT & TICKETS ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        uid VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        category VARCHAR(50) NOT NULL,
        priority VARCHAR(50) DEFAULT 'Medium',
        status VARCHAR(50) DEFAULT 'Open',
        assigned_staff_id VARCHAR(128) REFERENCES users(uid) ON DELETE SET NULL,
        subject VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(50) REFERENCES support_tickets(ticket_number) ON DELETE CASCADE,
        sender_id VARCHAR(128) REFERENCES users(uid) ON DELETE CASCADE,
        message TEXT NOT NULL,
        attachments JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── SUBSCRIPTION PLANS ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        plan_type VARCHAR(50) NOT NULL DEFAULT 'paid',
        billing_cycle VARCHAR(50) DEFAULT 'monthly',
        price DECIMAL(12,2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'INR',
        trial_days INTEGER DEFAULT 0,
        max_vehicles INTEGER DEFAULT 0,
        max_drivers INTEGER DEFAULT 0,
        max_storage_gb DECIMAL(10,2) DEFAULT 1.00,
        is_active BOOLEAN DEFAULT TRUE,
        is_custom BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── PLAN FEATURES ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_features (
        id SERIAL PRIMARY KEY,
        plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
        feature_key VARCHAR(100) NOT NULL,
        feature_label VARCHAR(255) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        feature_limit VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(plan_id, feature_key)
      );
    `);

    // ── ORGANIZATION SUBSCRIPTIONS ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_subscriptions (
        id SERIAL PRIMARY KEY,
        org_uid VARCHAR(128) NOT NULL,
        plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'trial',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        trial_ends_at TIMESTAMP,
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        renewed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        suspended_at TIMESTAMP,
        suspension_reason TEXT,
        vehicles_used INTEGER DEFAULT 0,
        drivers_used INTEGER DEFAULT 0,
        storage_used_gb DECIMAL(10,2) DEFAULT 0.00,
        payment_gateway VARCHAR(50),
        gateway_subscription_id VARCHAR(255),
        gateway_customer_id VARCHAR(255),
        auto_renew BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_sub_org_uid ON organization_subscriptions(org_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_sub_status ON organization_subscriptions(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_sub_plan_id ON organization_subscriptions(plan_id);`);

    // ── SUBSCRIPTION INVOICES ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        subscription_id INTEGER REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
        org_uid VARCHAR(128) NOT NULL,
        plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax_amount DECIMAL(12,2) DEFAULT 0.00,
        discount_amount DECIMAL(12,2) DEFAULT 0.00,
        total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'INR',
        status VARCHAR(50) DEFAULT 'pending',
        billing_period_start TIMESTAMP,
        billing_period_end TIMESTAMP,
        due_date TIMESTAMP,
        paid_at TIMESTAMP,
        payment_gateway VARCHAR(50),
        gateway_order_id VARCHAR(255),
        gateway_payment_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_inv_org ON subscription_invoices(org_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_inv_status ON subscription_invoices(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_inv_sub_id ON subscription_invoices(subscription_id);`);

    // ── SUBSCRIPTION PAYMENTS ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES subscription_invoices(id) ON DELETE SET NULL,
        org_uid VARCHAR(128) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        payment_method VARCHAR(50),
        payment_gateway VARCHAR(50),
        gateway_payment_id VARCHAR(255),
        gateway_order_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'success',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_pay_invoice ON subscription_payments(invoice_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_pay_org ON subscription_payments(org_uid);`);

    // ── SUBSCRIPTION AUDIT LOG ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_audit_log (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
        org_uid VARCHAR(128),
        admin_uid VARCHAR(128),
        action VARCHAR(100) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_audit_sub ON subscription_audit_log(subscription_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sub_audit_org ON subscription_audit_log(org_uid);`);

    // ── SEED: Default Subscription Plans ────────────────────────────────────
    const planCountRes = await client.query('SELECT COUNT(*) FROM subscription_plans');
    if (parseInt(planCountRes.rows[0].count, 10) === 0) {
      console.log('Seeding default subscription plans...');
      const plans = [
        ['Free Trial',    'free-trial',    'Full access for 14 days to evaluate the platform',                      'trial',      'none',     0,      14, 5,     5,    1.00,  true, false, 0],
        ['Starter',       'starter',       'Essential fleet tracking for small businesses',                         'paid',       'monthly',  999,    0,  25,    25,   5.00,  true, false, 1],
        ['Professional',  'professional',  'Advanced fleet management with analytics and reporting',                'paid',       'monthly',  2999,   0,  100,   100,  25.00, true, false, 2],
        ['Enterprise',    'enterprise',    'Custom pricing with unlimited access, dedicated support, and SLA',      'custom',     'annual',   0,      0,  999999,999999,100.00,true, true,  3],
      ];
      for (const p of plans) {
        await client.query(
          `INSERT INTO subscription_plans (name, slug, description, plan_type, billing_cycle, price, trial_days, max_vehicles, max_drivers, max_storage_gb, is_active, is_custom, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          p
        );
      }

      // Seed plan features
      const allPlans = await client.query('SELECT id, slug FROM subscription_plans ORDER BY sort_order');
      const featureMatrix = {
        'free-trial':    { live_tracking: true, trip_management: true, basic_alerts: true, driver_management: true, basic_reports: true, fuel_monitoring: true, advanced_analytics: false, api_access: false, custom_reports: false, priority_support: false, sla_guarantee: false, white_label: false },
        'starter':       { live_tracking: true, trip_management: true, basic_alerts: true, driver_management: true, basic_reports: true, fuel_monitoring: true, advanced_analytics: false, api_access: false, custom_reports: false, priority_support: false, sla_guarantee: false, white_label: false },
        'professional':  { live_tracking: true, trip_management: true, basic_alerts: true, driver_management: true, basic_reports: true, fuel_monitoring: true, advanced_analytics: true, api_access: true,  custom_reports: true,  priority_support: true,  sla_guarantee: false, white_label: false },
        'enterprise':    { live_tracking: true, trip_management: true, basic_alerts: true, driver_management: true, basic_reports: true, fuel_monitoring: true, advanced_analytics: true, api_access: true,  custom_reports: true,  priority_support: true,  sla_guarantee: true,  white_label: true  },
      };
      const featureLabels = {
        live_tracking: 'Live Vehicle Tracking', trip_management: 'Trip Management', basic_alerts: 'Basic Alerts', driver_management: 'Driver Management',
        basic_reports: 'Basic Reports', fuel_monitoring: 'Fuel Monitoring', advanced_analytics: 'Advanced Analytics', api_access: 'API Access',
        custom_reports: 'Custom Reports', priority_support: 'Priority Support', sla_guarantee: 'SLA Guarantee', white_label: 'White Label'
      };
      for (const plan of allPlans.rows) {
        const features = featureMatrix[plan.slug];
        if (!features) continue;
        for (const [key, enabled] of Object.entries(features)) {
          await client.query(
            `INSERT INTO plan_features (plan_id, feature_key, feature_label, is_enabled)
             VALUES ($1, $2, $3, $4) ON CONFLICT (plan_id, feature_key) DO NOTHING`,
            [plan.id, key, featureLabels[key] || key, enabled]
          );
        }
      }
      console.log('✅ Subscription plans and features seeded successfully.');
    }

    // ── ACCOUNT DELETION REQUESTS ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_deletion_requests (
        id SERIAL PRIMARY KEY,
        user_uid VARCHAR(128) NOT NULL,
        org_uid VARCHAR(128),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        failed_at TIMESTAMP,
        retry_count INTEGER DEFAULT 0,
        failure_code VARCHAR(100),
        idempotency_key VARCHAR(128) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_del_req_user ON account_deletion_requests(user_uid);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_del_req_status ON account_deletion_requests(status);`);

    console.log('✅ Database initialized successfully');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message || err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
