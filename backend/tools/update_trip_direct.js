const tripService = require('../services/tripService');
(async () => {
  try {
    const updated = await tripService.updateTrip('default_user', 'TRP-4404', { currentMileage: 2.0 });
    console.log('updated:', updated);
  } catch (err) {
    console.error('error:', err);
  } finally {
    process.exit(0);
  }
})();
