// d:\DY\backend\update_trigger.js
const { pool } = require('./config/dbconfig');

(async () => {
  try {
    console.log('Updating PostgreSQL trigger compute_trip_metrics() to allow clean zero reset when distance = 0...\n');
    
    // Drop existing trigger and function
    await pool.query('DROP TRIGGER IF EXISTS trips_compute_idle_money_wasted ON trips');
    await pool.query('DROP FUNCTION IF EXISTS compute_idle_money_wasted()');
    await pool.query('DROP TRIGGER IF EXISTS trips_compute_metrics ON trips');
    await pool.query('DROP FUNCTION IF EXISTS compute_trip_metrics()');
    console.log('✅ Dropped old triggers and functions');
    
    // Create new compute_trip_metrics function with zero reset support
    await pool.query(`
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
        -- If trip is not started, created, or distance is 0 & fuel_used is 0 (explicit reset), clear metrics
        IF NEW.status = 'not started' OR NEW.status = 'created' OR (COALESCE(NEW.distance, 0) = 0 AND COALESCE(NEW.fuel_used, 0) = 0) THEN
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

        -- Accumulate incremental deltas if distance increased
        IF dist_delta > 0 AND NEW.current_mileage > 0 THEN
          fuel_used_delta       := dist_delta / NEW.current_mileage;
          baseline_fuel_delta   := dist_delta / baseline_mileage;
          speeding_wasted_delta := GREATEST(0.0, fuel_used_delta - baseline_fuel_delta);

          IF TG_OP = 'UPDATE' THEN
            NEW.fuel_used            := ROUND((COALESCE(OLD.fuel_used, 0.0) + fuel_used_delta)::numeric, 2);
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
            NEW.fuel_used            := COALESCE(NEW.fuel_used, OLD.fuel_used, 0.0);
            NEW.speeding_fuel_wasted := COALESCE(NEW.speeding_fuel_wasted, OLD.speeding_fuel_wasted, 0.0);
            NEW.fuel_saved           := COALESCE(NEW.fuel_saved, OLD.fuel_saved, 0.0);
          END IF;
        END IF;

        NEW.money_saved := ROUND((NEW.fuel_saved * fprice)::numeric, 2);

        -- Idle Waste: Calculate ONLY on idle seconds exceeding owner's configured idle threshold
        idle_threshold_secs    := idle_threshold_mins * 60.0;
        idle_time_above_thresh := GREATEST(COALESCE(NEW.total_idle_time, 0) - idle_threshold_secs, 0.0);
        NEW.idle_money_wasted  := ROUND(((idle_time_above_thresh / 60.0) * (1.70 * (fprice / 100.0)))::numeric, 2);

        idle_fuel_wasted := CASE
          WHEN fprice > 0 THEN ROUND((NEW.idle_money_wasted / fprice)::numeric, 2)
          ELSE 0.0
        END;

        NEW.theft_money_loss := ROUND((COALESCE(NEW.theft_fuel_loss, 0.0) * fprice)::numeric, 2);

        -- Total fuel wasted = speeding fuel wasted + idle fuel wasted + theft fuel loss
        NEW.fuel_wasted := ROUND((NEW.speeding_fuel_wasted + idle_fuel_wasted + COALESCE(NEW.theft_fuel_loss, 0.0))::numeric, 2);

        NEW.money_wasted := ROUND((NEW.fuel_wasted * fprice)::numeric, 2);
        NEW.updated_at := CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created PostgreSQL function compute_trip_metrics()');
    
    // Create triggers
    await pool.query(`
      CREATE TRIGGER trips_compute_metrics
      BEFORE INSERT OR UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION compute_trip_metrics();
    `);
    await pool.query(`
      CREATE TRIGGER trips_compute_idle_money_wasted
      BEFORE INSERT OR UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION compute_trip_metrics();
    `);
    console.log('✅ Attached triggers to trips table\n');
    
    console.log('PostgreSQL trigger update complete!');
    await pool.end();
  } catch (e) { 
    console.error('Error updating trigger:', e.message); 
    process.exit(1); 
  }
})();
