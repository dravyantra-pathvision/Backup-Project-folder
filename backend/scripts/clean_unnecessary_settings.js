// scripts/clean_unnecessary_settings.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function cleanSettings() {
  console.log('🧹 Cleaning unnecessary settings from PostgreSQL system_settings table...');

  // Keep ONLY these 14 essential, app-relevant settings
  const essentialSettings = [
    // 1. General & Platform Identity (general)
    ['platform_name', '"DravYantra PathVision"', 'general', false, false, 'Platform title displayed across mobile apps & admin portal'],
    ['support_email', '"support@dravyantra.com"', 'general', false, false, 'Official helpdesk support email rendered in mobile apps'],
    ['default_timezone', '"Asia/Kolkata"', 'general', false, false, 'System timezone for calculating trip timestamps & report dates'],
    ['default_currency', '"₹ (INR)"', 'general', false, false, 'Base currency symbol for fuel cost & financial metrics'],

    // 2. Fleet & Safety Thresholds (thresholds)
    ['overspeed_threshold_kmh', '80', 'thresholds', false, false, 'Global speed limit ceiling in km/h triggering real-time speed violation alerts'],
    ['offline_device_timeout_min', '10', 'thresholds', false, false, 'Inactivity duration in minutes before marking vehicle device offline'],
    ['auto_close_trip_min', '60', 'thresholds', false, false, 'Stationary duration in minutes after which an ongoing trip auto-ends'],

    // 3. Fuel & Cost Management (fuel)
    ['fuel_theft_threshold_pct', '5.0', 'fuel', false, false, 'Sudden fuel tank level drop percentage triggering a theft alert'],
    ['idle_threshold_minutes', '15', 'fuel', false, false, 'Stationary engine operation duration in minutes triggering idling waste alert'],
    ['standard_fuel_price_per_liter', '96.50', 'fuel', false, false, 'Standard benchmark fuel price per liter in INR for financial metrics'],

    // 4. Alerts & Integrations (alerts)
    ['whatsapp_gateway_enabled', 'true', 'alerts', false, false, 'Enables real-time WhatsApp alert dispatch to Fleet Owners'],
    ['map_provider', '"OpenStreetMap"', 'alerts', false, false, 'GIS mapping provider engine for live vehicle tracking (OpenStreetMap / Google Maps)'],
    ['cloud_storage_bucket', '"dravyantra-uploads"', 'alerts', false, false, 'AWS S3 bucket name storing driver photos & vehicle documents'],
    ['maintenance_mode', 'false', 'alerts', false, false, 'Master switch to restrict app logins during system upgrades']
  ];

  const keysToKeep = essentialSettings.map(s => s[0]);

  // Delete all non-essential rows
  const deleteRes = await pool.query(
    'DELETE FROM system_settings WHERE key NOT IN (' + keysToKeep.map((_, i) => `$${i + 1}`).join(',') + ')',
    keysToKeep
  );
  console.log(`🗑️ Removed ${deleteRes.rowCount} unnecessary settings rows.`);

  // Upsert the 14 essential settings
  for (const s of essentialSettings) {
    await pool.query(
      `INSERT INTO system_settings (key, value, category, is_sensitive, requires_super_admin, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           requires_super_admin = false`,
      s
    );
  }

  console.log(`✅ Cleaned DB! Currently hosting ${essentialSettings.length} essential DravYantra settings across 4 categories.`);
  process.exit(0);
}

cleanSettings().catch(err => {
  console.error('Error cleaning settings:', err);
  process.exit(1);
});
