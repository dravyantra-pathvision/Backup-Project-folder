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
const fleetSettingsRoutes = require('./routes/fleetSettingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const tripUpdater = require('./services/tripUpdater');
const dbListener = require('./services/dbListener');
const dbPoller = require('./services/dbPoller');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use(requestLogger);

// Catch JSON parse errors
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/fuel_logs', fuelRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/fleet-settings', fleetSettingsRoutes);
app.use('/api/reports', reportRoutes);

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
    } catch (e) {
      console.error('Background services failed:', e && e.message);
    }
  });
};

startServer().catch(e => console.error('Server start error:', e && e.message));
