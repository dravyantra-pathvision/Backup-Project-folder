// scripts/seed_comprehensive_settings.js
require('dotenv').config();
const { pool } = require('../config/dbconfig');

async function seedSettings() {
  console.log('🔄 Upserting comprehensive DravYantra system settings...');

  const settingsList = [
    // 1. General & Branding (general)
    ['platform_name', '"DravYantra PathVision"', 'general', false, false, 'Official platform title rendered across web portal & mobile apps'],
    ['support_email', '"support@dravyantra.com"', 'general', false, false, 'Help desk email contact rendered in mobile apps'],
    ['support_phone', '"+91 98765 43210"', 'general', false, false, 'Toll-free emergency helpline number'],
    ['default_timezone', '"Asia/Kolkata"', 'general', false, false, 'Default timezone for calculating trip timestamps & report dates'],
    ['default_currency', '"₹ (INR)"', 'general', false, false, 'Base currency symbol for billing & fuel cost metrics'],
    ['default_language', '"en-IN"', 'general', false, false, 'Primary interface language code'],

    // 2. Fleet Telemetry & Safety Rules (telemetry)
    ['overspeed_threshold_kmh', '80', 'telemetry', false, false, 'Global speed ceiling in km/h triggering real-time speed alert'],
    ['telemetry_ping_interval_sec', '5', 'telemetry', false, false, 'Hardware GPS ping transmission frequency in seconds'],
    ['offline_device_timeout_min', '10', 'telemetry', false, false, 'Inactivity duration before flagging vehicle device offline'],
    ['auto_close_trip_min', '60', 'telemetry', false, false, 'Stationary duration in minutes after which an ongoing trip auto-ends'],

    // 3. Fuel Theft & Risk Intelligence (fuel_risk)
    ['fuel_theft_threshold_pct', '5.0', 'fuel_risk', false, false, 'Sudden fuel level drop percentage triggering a theft alert'],
    ['idle_threshold_minutes', '15', 'fuel_risk', false, false, 'Stationary engine operation duration in minutes triggering idling waste alert'],
    ['standard_fuel_price_per_liter', '96.50', 'fuel_risk', false, false, 'Default benchmark fuel price per liter in INR for financial metrics'],
    ['harsh_driving_gforce_threshold', '0.4', 'fuel_risk', false, false, 'G-force sensor threshold for flagging harsh braking or acceleration'],

    // 4. WhatsApp, SMS & Email Gateways (communications)
    ['whatsapp_gateway_enabled', 'true', 'communications', false, false, 'Enables real-time WhatsApp alert dispatch to Fleet Owners'],
    ['sms_emergency_enabled', 'true', 'communications', false, false, 'Enables instant SMS dispatch for critical vehicle safety alerts'],
    ['smtp_host', '"smtp.gmail.com"', 'communications', false, false, 'SMTP mail server host address'],
    ['smtp_port', '587', 'communications', false, false, 'SMTP mail server port (587 TLS / 465 SSL)'],
    ['smtp_user', '"dravyantra.pathvision@gmail.com"', 'communications', false, false, 'System notification email account'],
    ['otp_expiry_minutes', '10', 'communications', false, false, 'Validity duration in minutes for login & verification OTPs'],

    // 5. AWS S3, Maps & Integrations (integrations)
    ['cloud_storage_bucket', '"dravyantra-uploads"', 'integrations', false, false, 'AWS S3 bucket name for driver photos & vehicle documents'],
    ['aws_region', '"ap-south-2"', 'integrations', false, false, 'Active AWS data center region (Hyderabad)'],
    ['map_provider', '"OpenStreetMap"', 'integrations', false, false, 'GIS mapping engine for live vehicle tracking (OpenStreetMap / Google Maps)'],
    ['payment_gateway', '"Razorpay"', 'integrations', false, false, 'Payment gateway processor for subscription plan renewals'],

    // 6. Security, Sessions & Compliance (security)
    ['jwt_expiry_hours', '24', 'security', false, false, 'Expiration window in hours for admin authentication JWT tokens'],
    ['session_timeout_minutes', '30', 'security', false, false, 'Inactivity duration in minutes before automatically locking web portal'],
    ['password_min_length', '8', 'security', false, false, 'Minimum required password character length'],
    ['password_require_uppercase', 'true', 'security', false, false, 'Requires at least one uppercase letter (A-Z) in user passwords'],
    ['password_require_special', 'true', 'security', false, false, 'Requires at least one special symbol (!@#$) in user passwords'],
    ['api_rate_limit_per_minute', '100', 'security', false, false, 'Maximum API requests permitted per minute per IP address'],
    ['audit_log_retention_days', '90', 'security', false, false, 'Number of days to retain system audit log history'],

    // 7. System Maintenance & Backups (system)
    ['maintenance_mode', 'false', 'system', false, false, 'Restricts non-admin portal & app access during system upgrades'],
    ['maintenance_message', '"DravYantra is undergoing scheduled maintenance. Normal service will resume shortly."', 'system', false, false, 'System notice displayed during maintenance mode'],
    ['audit_logging_enabled', 'true', 'system', false, false, 'Enables recording of all admin operations to database audit history'],
    ['backup_enabled', 'true', 'system', false, false, 'Enables automated nightly database backups to AWS S3'],
    ['backup_schedule', '"0 2 * * *"', 'system', false, false, 'Cron schedule pattern for automated database backups']
  ];

  for (const s of settingsList) {
    await pool.query(
      `INSERT INTO system_settings (key, value, category, is_sensitive, requires_super_admin, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE 
       SET category = EXCLUDED.category,
           description = EXCLUDED.description,
           requires_super_admin = false`,
      s
    );
  }

  console.log(`✅ Upserted ${settingsList.length} DravYantra system settings across 7 categories!`);
  process.exit(0);
}

seedSettings().catch(err => {
  console.error('Error seeding settings:', err);
  process.exit(1);
});
