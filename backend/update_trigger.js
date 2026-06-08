const { pool } = require('./config/dbconfig');

(async () => {
  try {
    console.log('Recreating trigger with fuel_wasted and money_wasted calculations...\n');
    
    // Drop existing trigger and function
    await pool.query('DROP TRIGGER IF EXISTS trips_compute_idle_money_wasted ON trips');
    console.log('✅ Dropped old trigger');
    
    await pool.query('DROP FUNCTION IF EXISTS compute_idle_money_wasted()');
    console.log('✅ Dropped old function');
    
    // Create new function with full logic
    await pool.query(`
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
          -- Preserve explicit current_mileage values; only derive from live_speed when missing or invalid.
          IF COALESCE(NEW.current_mileage, 0) <= 0 THEN
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
          END IF;
        
        -- Calculate fuel_used
        NEW.fuel_used := CASE
          WHEN COALESCE(NEW.distance, 0) > 0 AND NEW.current_mileage > 0 THEN ROUND((NEW.distance / NEW.current_mileage)::numeric, 2)
          ELSE 0.0
        END;
        
        -- Calculate fuel_saved
        baseline_fuel := CASE
          WHEN COALESCE(NEW.distance, 0) > 0 THEN ROUND((NEW.distance / baseline_mileage)::numeric, 2)
          ELSE 0.0
        END;
        actual_fuel := COALESCE(NEW.fuel_used, 0.0);
        
        NEW.fuel_saved := CASE
          WHEN NEW.current_mileage > baseline_mileage AND baseline_fuel > actual_fuel THEN ROUND((baseline_fuel - actual_fuel)::numeric, 2)
          ELSE 0.0
        END;
        
        -- Calculate money_saved
        fuel_price := COALESCE(NEW.fuel_price_per_liter, 100.0);
        NEW.money_saved := CASE
          WHEN NEW.fuel_saved > 0 THEN ROUND((NEW.fuel_saved * fuel_price)::numeric, 2)
          ELSE 0.0
        END;
        
        -- Calculate idle_money_wasted
        NEW.idle_money_wasted := ROUND(COALESCE(NEW.total_idle_time, 0) * 1.7::numeric, 2);
        
        -- Calculate fuel_wasted and money_wasted
        -- Mileage fuel wasted only if current_mileage < baseline_mileage
        mileage_fuel_wasted := CASE
          WHEN NEW.current_mileage < baseline_mileage THEN ROUND((actual_fuel - baseline_fuel)::numeric, 2)
          ELSE 0.0
        END;
        
        -- Idle fuel wasted = idle_money_wasted / fuel_price_per_liter
        idle_fuel_wasted := CASE
          WHEN fuel_price > 0 THEN ROUND((NEW.idle_money_wasted / fuel_price)::numeric, 2)
          ELSE 0.0
        END;
        
        -- Total fuel wasted = mileage_fuel_wasted + idle_fuel_wasted
        NEW.fuel_wasted := ROUND((mileage_fuel_wasted + idle_fuel_wasted)::numeric, 2);

        -- Speeding fuel wasted is based on the row's current_mileage vs the 3.5 baseline.
        speeding_fuel_wasted := CASE
          WHEN NEW.current_mileage IS NULL OR NEW.current_mileage <= 0 OR NEW.current_mileage >= baseline_mileage OR COALESCE(NEW.distance, 0) <= 0 THEN 0.0
          ELSE ROUND(GREATEST((COALESCE(NEW.distance, 0) / NEW.current_mileage) - (COALESCE(NEW.distance, 0) / baseline_mileage), 0.0)::numeric, 2)
        END;
        NEW.speeding_fuel_wasted := speeding_fuel_wasted;
        
        -- Money wasted = fuel_wasted × fuel_price_per_liter
        NEW.money_wasted := ROUND((NEW.fuel_wasted * fuel_price)::numeric, 2);
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Created new function with complete logic');
    
    // Create trigger
    await pool.query(`
      CREATE TRIGGER trips_compute_idle_money_wasted
      BEFORE INSERT OR UPDATE ON trips
      FOR EACH ROW EXECUTE FUNCTION compute_idle_money_wasted();
    `);
    console.log('✅ Created new trigger\n');
    
    console.log('Trigger deployment complete!');
    await pool.end();
  } catch(e) { 
    console.error('Error:', e.message); 
    process.exit(1); 
  }
})();
