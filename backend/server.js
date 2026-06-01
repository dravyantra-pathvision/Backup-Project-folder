// server.js
// Modular backend entry point replacing monolithic index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/dbconfig');
const { requestLogger } = require('./middleware/loggerMiddleware');

// Global process-level handlers to log unexpected errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // Do NOT exit here to keep the server running; log and continue.
  // Consider investigating and restarting the process externally if instability occurs.
});

// Route Imports
const userRoutes = require('./routes/userRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const fuelRoutes = require('./routes/fuelRoutes');
const tripRoutes = require('./routes/tripRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const fleetSettingsRoutes = require('./routes/fleetSettingsRoutes');
const tripUpdater = require('./services/tripUpdater');
const dbListener = require('./services/dbListener');
const dbPoller = require('./services/dbPoller');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (dashboard)
app.use(requestLogger);

// Initialize DB schema and ensure migrations complete before accepting requests
// Await initDB() so incoming requests don't race against schema creation
const startServer = async () => {
  await initDB();

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // start background trip updater after DB initialization
      try {
      const disableBg = (process.env.DISABLE_BACKGROUND_UPDATER === 'true');
      if (!disableBg) {
        const interval = Number(process.env.TRIP_UPDATER_INTERVAL_MS) || 5000;
        tripUpdater.start(interval);
        // start DB LISTEN/NOTIFY listener so direct DB changes trigger alerts
        try { dbListener.start(); } catch (e) { console.error('Failed to start DB listener:', e && e.message); }
        // Start DB poller fallback (will retry if DB is unreachable)
        try { dbPoller.start(); } catch (e) { console.error('Failed to start DB poller:', e && e.message); }
      } else {
        console.log('Background updaters disabled via DISABLE_BACKGROUND_UPDATER=true');
      }
    } catch (e) {
      console.error('Failed to start trip updater:', e);
    }
  });
};

startServer().catch(e => {
  console.error('Failed to initialize DB and start server:', e && e.message);
  process.exit(1);
});

// API Routes Mounting
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/fuel_logs', fuelRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/fleet-settings', fleetSettingsRoutes);

// Centralized error fallback middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error captured:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Removed immediate listen; server is started after DB init above.
