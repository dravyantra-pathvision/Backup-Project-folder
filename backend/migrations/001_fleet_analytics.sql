-- ============================================================
-- DravYantra Fleet Analytics System
-- Migration 001: Production-Grade Trip Statistics & Analytics
-- Run once on AWS RDS PostgreSQL
-- ============================================================

BEGIN;

-- ============================================================
-- 1. TRIPS TABLE — Add new analytics columns
-- ============================================================

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS start_time            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS start_fuel            DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS start_lat             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS start_lng             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS fuel_price_snapshot   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS moving_time_seconds   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS running_time_seconds  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_speed             DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overspeed_events      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harsh_braking_events  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rapid_accel_events    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_refill_count     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_count           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_score            INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS co2_emitted           DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trip_state            VARCHAR(20) DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS paused_at             TIMESTAMP,
  ADD COLUMN IF NOT EXISTS resumed_at            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS frozen_at             TIMESTAMP;

-- NOTE: start_odometer is intentionally NOT added. Odometer feature removed.
-- NOTE: avg_speed is derived: distance / moving_time_seconds — never stored.
-- NOTE: fuel_cost is derived: fuel_used × fuel_price_snapshot — never stored.

-- ============================================================
-- 2. ALERTS TABLE — Add lifecycle columns
-- ============================================================

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS seen_at          TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ignored_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS lifecycle_state  VARCHAR(20) DEFAULT 'generated';

-- ============================================================
-- 3. FLEET_SETTINGS TABLE — Add configurable thresholds
-- ============================================================

ALTER TABLE fleet_settings
  ADD COLUMN IF NOT EXISTS fuel_price_per_liter          DOUBLE PRECISION DEFAULT 92.0,
  ADD COLUMN IF NOT EXISTS co2_factor_per_liter          DOUBLE PRECISION DEFAULT 2.68,
  ADD COLUMN IF NOT EXISTS gps_drift_threshold_km        DOUBLE PRECISION DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS gps_max_jump_km               DOUBLE PRECISION DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS fuel_noise_threshold_liters   DOUBLE PRECISION DEFAULT 0.3,
  ADD COLUMN IF NOT EXISTS fuel_refill_threshold_liters  DOUBLE PRECISION DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS fuel_theft_threshold_liters   DOUBLE PRECISION DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS overspeed_threshold_kmh       INTEGER DEFAULT 80,
  ADD COLUMN IF NOT EXISTS idle_warning_seconds          INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS idle_critical_seconds         INTEGER DEFAULT 900,
  ADD COLUMN IF NOT EXISTS harsh_brake_delta_kmh         INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS rapid_accel_delta_kmh         INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS heartbeat_timeout_seconds     INTEGER DEFAULT 120,
  ADD COLUMN IF NOT EXISTS fastag_threshold              INTEGER DEFAULT 500;

-- ============================================================
-- 4. DEVICES TABLE — Add device health columns
-- ============================================================

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS connection_status        VARCHAR(20) DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_packet_at           TIMESTAMP,
  ADD COLUMN IF NOT EXISTS heartbeat_delay_seconds  INTEGER,
  ADD COLUMN IF NOT EXISTS signal_quality           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gps_fix_status           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS battery_voltage          DOUBLE PRECISION;

-- ============================================================
-- 5. VEHICLE_LIFETIME_STATS TABLE — Per-vehicle cumulative stats
--    Never resets. Updated only when trip_completed = true.
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_lifetime_stats (
  plate                    VARCHAR(50) PRIMARY KEY,
  uid                      VARCHAR(100) NOT NULL,
  total_distance_km        DOUBLE PRECISION DEFAULT 0,
  total_fuel_consumed_l    DOUBLE PRECISION DEFAULT 0,
  total_trips              INTEGER DEFAULT 0,
  total_completed_trips    INTEGER DEFAULT 0,
  lifetime_idle_seconds    INTEGER DEFAULT 0,
  lifetime_running_seconds INTEGER DEFAULT 0,
  lifetime_moving_seconds  INTEGER DEFAULT 0,
  lifetime_co2_kg          DOUBLE PRECISION DEFAULT 0,
  fuel_theft_count         INTEGER DEFAULT 0,
  fuel_refill_count        INTEGER DEFAULT 0,
  total_overspeed_events   INTEGER DEFAULT 0,
  total_harsh_braking      INTEGER DEFAULT 0,
  total_alert_count        INTEGER DEFAULT 0,
  avg_trip_score           DOUBLE PRECISION DEFAULT 100,
  vehicle_health_score     INTEGER DEFAULT 100,
  engine_hours             DOUBLE PRECISION DEFAULT 0,
  created_at               TIMESTAMP DEFAULT NOW(),
  updated_at               TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 6. TELEMETRY_HISTORY TABLE — Every validated packet archived
--    Source for playback, analytics, debugging.
-- ============================================================

CREATE TABLE IF NOT EXISTS telemetry_history (
  id                BIGSERIAL PRIMARY KEY,
  device_id         VARCHAR(50) NOT NULL,
  vehicle_plate     VARCHAR(50),
  trip_id           VARCHAR(100),
  uid               VARCHAR(100),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  speed             INTEGER,
  fuel_level        DOUBLE PRECISION,
  engine_on         BOOLEAN,
  vibration         DOUBLE PRECISION,
  heading           DOUBLE PRECISION,
  rpm               INTEGER,
  signal_quality    VARCHAR(20),
  heartbeat         BOOLEAN,
  raw_timestamp     TIMESTAMP,
  received_at       TIMESTAMP DEFAULT NOW(),
  is_valid          BOOLEAN DEFAULT TRUE,
  validation_notes  TEXT,
  distance_delta_km DOUBLE PRECISION,
  fuel_delta_l      DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time  ON telemetry_history(device_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_trip         ON telemetry_history(trip_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_vehicle      ON telemetry_history(vehicle_plate, received_at DESC);

-- ============================================================
-- 7. FUEL_REFILL_EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS fuel_refill_events (
  id             BIGSERIAL PRIMARY KEY,
  uid            VARCHAR(100) NOT NULL,
  vehicle_plate  VARCHAR(50),
  trip_id        VARCHAR(100),
  driver         VARCHAR(100),
  fuel_before    DOUBLE PRECISION,
  fuel_after     DOUBLE PRECISION,
  amount_filled  DOUBLE PRECISION,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  detected_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refill_vehicle ON fuel_refill_events(vehicle_plate, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_refill_uid     ON fuel_refill_events(uid, detected_at DESC);

-- ============================================================
-- 8. FUEL_THEFT_EVENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS fuel_theft_events (
  id             BIGSERIAL PRIMARY KEY,
  uid            VARCHAR(100) NOT NULL,
  vehicle_plate  VARCHAR(50),
  trip_id        VARCHAR(100),
  driver         VARCHAR(100),
  fuel_before    DOUBLE PRECISION,
  fuel_after     DOUBLE PRECISION,
  fuel_lost      DOUBLE PRECISION,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  detected_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theft_vehicle ON fuel_theft_events(vehicle_plate, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_theft_uid     ON fuel_theft_events(uid, detected_at DESC);

-- ============================================================
-- 9. Initialize trip_state for existing trips
-- ============================================================

UPDATE trips SET trip_state = 'completed' WHERE trip_completed = TRUE AND trip_state IS NULL;
UPDATE trips SET trip_state = 'cancelled' WHERE status = 'cancelled' AND trip_state IS NULL;
UPDATE trips SET trip_state = 'running'   WHERE status IN ('in progress', 'running', 'idle', 'halted') AND trip_completed IS NOT TRUE AND trip_state IS NULL;
UPDATE trips SET trip_state = 'created'   WHERE trip_state IS NULL;

-- ============================================================
-- 10. Initialize alert lifecycle_state for existing alerts
-- ============================================================

UPDATE alerts SET lifecycle_state = 'acknowledged' WHERE status = 'acknowledged' AND lifecycle_state IS NULL;
UPDATE alerts SET lifecycle_state = 'ignored'      WHERE status = 'dismissed'    AND lifecycle_state IS NULL;
UPDATE alerts SET lifecycle_state = 'generated'    WHERE lifecycle_state IS NULL;

COMMIT;
