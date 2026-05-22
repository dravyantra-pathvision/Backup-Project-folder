// server.js
// Modular backend entry point replacing monolithic index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/dbconfig');
const { requestLogger } = require('./middleware/loggerMiddleware');

// Route Imports
const userRoutes = require('./routes/userRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const fuelRoutes = require('./routes/fuelRoutes');
const tripRoutes = require('./routes/tripRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const tripUpdater = require('./services/tripUpdater');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files (dashboard)
app.use(requestLogger);

// Initialize DB schema
initDB();

// API Routes Mounting
app.use('/api/users', userRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/fuel_logs', fuelRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/upload', uploadRoutes);

// Centralized error fallback middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error captured:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // start background trip updater that recalculates savings every second
  try {
    const interval = Number(process.env.TRIP_UPDATER_INTERVAL_MS) || 5000;
    tripUpdater.start(interval);
  } catch (e) {
    console.error('Failed to start trip updater:', e);
  }
});
