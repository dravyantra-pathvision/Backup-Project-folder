const { Client } = require('pg');
require('dotenv').config();

(async () => {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(`
      CREATE OR REPLACE FUNCTION public.compute_idle_money_wasted()
      RETURNS trigger AS $$
      BEGIN
        NEW.idle_money_wasted := ROUND(COALESCE(NEW.total_idle_time, 0) * 1.7::numeric, 2);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trips_compute_idle_money_wasted ON public.trips;
    `);
    await client.query(`
      CREATE TRIGGER trips_compute_idle_money_wasted
      BEFORE INSERT OR UPDATE ON public.trips
      FOR EACH ROW
      EXECUTE FUNCTION public.compute_idle_money_wasted();
    `);
    await client.query(`
      UPDATE public.trips SET idle_money_wasted = ROUND(COALESCE(total_idle_time, 0) * 1.7::numeric, 2) WHERE total_idle_time IS NOT NULL;
    `);
    const trig = await client.query("SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.trips'::regclass AND tgname = 'trips_compute_idle_money_wasted';");
    const func = await client.query("SELECT proname FROM pg_proc WHERE proname = 'compute_idle_money_wasted';");
    console.log('trigger rows:', JSON.stringify(trig.rows, null, 2));
    console.log('function rows:', JSON.stringify(func.rows, null, 2));
  } catch (e) {
    console.error('failed to create trigger', e);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
