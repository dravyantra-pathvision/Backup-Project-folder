const { checkAndAlert } = require('./services/fuelTheftDetector');
const { pool } = require('./config/dbconfig');

async function runTest() {
  console.log("Triggering mock rash driving alert...");
  // Simulate a trip update
  const prevTrip = { id: 'T-123', vehiclePlate: 'TEST-123', driverName: 'John', liveSpeed: 60, power: true, _updatedAt: new Date(Date.now() - 5000).toISOString() };
  const newTrip = { id: 'T-123', vehiclePlate: 'TEST-123', driverName: 'John', liveSpeed: 100, power: true, _updatedAt: new Date().toISOString() };
  
  await checkAndAlert(prevTrip, newTrip);
  
  console.log("Test finished.");
  process.exit(0);
}

runTest();
