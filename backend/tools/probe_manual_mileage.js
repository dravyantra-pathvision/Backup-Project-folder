const tripService = require('../services/tripService');

(async () => {
  try {
    const updated = await tripService.updateTrip('default_user', 'TRP-4404', {
      currentMileage: 2.0,
      liveSpeed: 0,
      liveFuelCount: 132,
    });
    console.log(JSON.stringify(updated, null, 2));
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    process.exit(0);
  }
})();
