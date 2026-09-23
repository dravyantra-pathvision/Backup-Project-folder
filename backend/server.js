// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/dbconfig');
const { requestLogger } = require('./middleware/loggerMiddleware');

// Global handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

// Route imports
const userRoutes = require('./routes/userRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const fuelRoutes = require('./routes/fuelRoutes');
const tripRoutes = require('./routes/tripRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const authRoutes = require('./routes/authRoutes');
const fleetSettingsRoutes = require('./routes/fleetSettingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const telemetryRoutes = require('./routes/telemetryRoutes');
const supportRoutes = require('./routes/supportRoutes');
const fleetStatsRoutes = require('./routes/fleetStatsRoutes');
const vehicleLifetimeRoutes = require('./routes/vehicleLifetimeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./modules/admin/admin.routes');
const tripUpdater = require('./services/tripUpdater');
const dbListener = require('./services/dbListener');
const dbPoller = require('./services/dbPoller');
const { startScheduler } = require('./jobs/reportScheduler');
const { startComplianceScheduler } = require('./jobs/complianceChecker');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/web', express.static(path.join(__dirname, '../dravyantra_web_page')));
app.use('/terms', (req, res) => res.sendFile(path.join(__dirname, '../dravyantra_web_page/terms.html')));
app.use('/privacy', (req, res) => res.sendFile(path.join(__dirname, '../dravyantra_web_page/privacy.html')));
app.use(requestLogger);

// Catch JSON parse errors
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

const requireApprovedOrg = require('./middleware/requireApprovedOrg');
const { verifyToken } = require('./middleware/authMiddleware');

// API Routes — Fleet Owner (Unprotected by Org Status)
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);

// API Routes — Fleet Owner (Protected by Org Status)
app.use('/api/vehicles', verifyToken, requireApprovedOrg, vehicleRoutes);
app.use('/api/drivers', verifyToken, requireApprovedOrg, driverRoutes);

// Unprotected routes
app.use('/api/auth', authRoutes);

// More Protected Routes
app.use('/api/trips', verifyToken, requireApprovedOrg, tripRoutes);
app.use('/api/upload', verifyToken, requireApprovedOrg, uploadRoutes);
app.use('/api/alerts', verifyToken, requireApprovedOrg, alertsRoutes);
app.use('/api/fuel_logs', verifyToken, requireApprovedOrg, fuelRoutes);
app.use('/api/fleet-settings', verifyToken, requireApprovedOrg, fleetSettingsRoutes);
app.use('/api/reports', verifyToken, requireApprovedOrg, reportRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/support', verifyToken, requireApprovedOrg, supportRoutes);

// Analytics API
app.use('/api/analytics/fleet', verifyToken, requireApprovedOrg, fleetStatsRoutes);
app.use('/api/analytics/vehicles', verifyToken, requireApprovedOrg, vehicleLifetimeRoutes);
app.use('/api/analytics/savings-wallet', verifyToken, requireApprovedOrg, require('./routes/savingsWalletRoutes'));
app.use('/api/analytics', verifyToken, requireApprovedOrg, require('./routes/scorecardRoutes'));

// Notifications
app.use('/api/notifications', verifyToken, requireApprovedOrg, notificationRoutes);

// Account Deletion API
app.use('/api/account', require('./routes/accountRoutes'));

// API Routes — Admin (admin role required — enforced inside module)
app.use('/api/admin', adminRoutes);

// Baseline seeding helper for simulation/demo
app.all('/api/seed-baselines', async (req, res) => {
  const simVehicles = [
    { plate: 'KA 01 AB 1234', deviceId: 'DEV-SIM-001', driverId: 'DRV-KARTIK-01', driverName: 'Kartik' },
    { plate: 'KA 02 CD 5678', deviceId: 'DEV-SIM-002', driverId: 'DRV-ANAND-02', driverName: 'Anand' },
    { plate: 'KA 03 EF 9012', deviceId: 'DEV-SIM-003', driverId: 'DRV-CHAKRA-03', driverName: 'Chakravarthi' },
    { plate: 'KA 33 W 1234', deviceId: 'DEV-001', driverId: 'DRV-RAJESH-01', driverName: 'Rajesh Kumar' },
    { plate: 'KA 33 W 5678', deviceId: 'DEV-002', driverId: 'DRV-SURESH-02', driverName: 'Suresh Patel' },
    { plate: 'KA 33 W 6777', deviceId: 'DEV-003', driverId: 'DRV-AMIT-03', driverName: 'Amit Sharma' },
  ];

  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

  let dbSuccess = false;
  let rows = [];

  try {
    const { pool } = require('./config/dbconfig');
    const userRes = await pool.query(`SELECT uid FROM users WHERE role = 'fleet_owner' LIMIT 1`);
    const uid = userRes.rows[0]?.uid || 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';

    for (const v of simVehicles) {
      await pool.query(`
        INSERT INTO vehicles (plate, device_id, uid, driver, status, speed, fuel, is_active, is_deleted)
        VALUES ($1, $2, $3, $4, 'moving', 0, 90.0, true, false)
        ON CONFLICT (plate) DO UPDATE SET is_active = true, is_deleted = false
      `, [v.plate, v.deviceId, uid, v.driverName]);

      await pool.query(`
        INSERT INTO drivers (id, uid, name, phone, lic, vehicle, status, score)
        VALUES ($1, $2, $3, '9876543210', 'DL-IND-999', $4, 'Active', 100)
        ON CONFLICT (id) DO UPDATE SET vehicle = $4, status = 'Active'
      `, [v.driverId, uid, v.driverName, v.plate]);

      await pool.query(`
        INSERT INTO vehicle_baselines (
          uid, vehicle_id, baseline_start_date, baseline_end_date, baseline_duration_days,
          baseline_distance, baseline_fuel_consumed, baseline_efficiency,
          baseline_idle_hours, baseline_idle_fuel, baseline_overspeed_events, baseline_status
        )
        VALUES ($1, $2, $3, $4, 29, 3000.0, 750.0, 4.00, 30.0, 24.0, 30, 'completed')
        ON CONFLICT (uid, vehicle_id) DO UPDATE SET
          baseline_start_date = EXCLUDED.baseline_start_date,
          baseline_end_date = EXCLUDED.baseline_end_date,
          baseline_duration_days = 29,
          baseline_distance = 3000.0,
          baseline_fuel_consumed = 750.0,
          baseline_efficiency = 4.00,
          baseline_idle_hours = 30.0,
          baseline_idle_fuel = 24.0,
          baseline_overspeed_events = 30,
          baseline_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      `, [uid, v.plate, startDate, endDate]);
    }

    const baselinesRes = await pool.query(`
      SELECT b.id, b.uid, b.vehicle_id, v.driver, b.baseline_start_date, b.baseline_end_date,
             b.baseline_distance, b.baseline_fuel_consumed, b.baseline_efficiency,
             b.baseline_idle_hours, b.baseline_idle_fuel, b.baseline_overspeed_events, b.baseline_status
      FROM vehicle_baselines b
      LEFT JOIN vehicles v ON b.vehicle_id = v.plate
      WHERE b.baseline_status = 'completed'
      ORDER BY b.id ASC
    `);

    rows = baselinesRes.rows;
    dbSuccess = true;
  } catch (error) {
    console.warn('PostgreSQL baseline sync warning (using fallback memory store):', error.message);
  }

  if (!dbSuccess || rows.length === 0) {
    rows = simVehicles.map((v, i) => ({
      id: i + 1,
      uid: 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2',
      vehicle_id: v.plate,
      driver: v.driverName,
      baseline_start_date: startDate,
      baseline_end_date: endDate,
      baseline_distance: 3000.0,
      baseline_fuel_consumed: 750.0,
      baseline_efficiency: 4.00,
      baseline_idle_hours: 30.0,
      baseline_idle_fuel: 24.0,
      baseline_overspeed_events: 30,
      baseline_status: 'completed',
    }));
  }

  return res.json({ success: true, db_synced: dbSuccess, count: rows.length, baselines: rows });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Centralized error fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server after DB init
const startServer = async () => {
  try {
    await initDB();
  } catch (e) {
    console.error('Failed to initialize DB (falling back to local store):', e && e.message);
    process.env.FORCE_LOCAL = 'true';
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT} (0.0.0.0)`);
    try {
      const disableBg = (process.env.DISABLE_BACKGROUND_UPDATER === 'true');
      if (!disableBg) {
        const interval = Number(process.env.TRIP_UPDATER_INTERVAL_MS) || 5000;
        try { tripUpdater.start(interval); } catch (e) { console.error('Trip updater start failed:', e && e.message); }
        try { dbPoller.start(); } catch (e) { console.error('DB poller start failed:', e && e.message); }
      }
      try { dbListener.start(); } catch (e) { console.error('DB listener start failed:', e && e.message); }
      try { startScheduler(); } catch (e) { console.error('Report scheduler start failed:', e && e.message); }
      try { startComplianceScheduler(); } catch (e) { console.error('Compliance scheduler start failed:', e && e.message); }
    } catch (e) {
      console.error('Background services failed:', e && e.message);
    }
  });
};

startServer().catch(e => console.error('Server start error:', e && e.message));
