const analyticsService = require('./modules/admin/analytics.service');

async function testAllServices() {
  const query = {
    from_date: '2026-06-06',
    to_date: '2026-07-06'
  };

  const services = [
    { name: 'getOverview', fn: analyticsService.getOverview },
    { name: 'getFuelAnalytics', fn: analyticsService.getFuelAnalytics },
    { name: 'getVehicleAnalytics', fn: analyticsService.getVehicleAnalytics },
    { name: 'getDriverAnalytics', fn: analyticsService.getDriverAnalytics },
    { name: 'getTripAnalytics', fn: analyticsService.getTripAnalytics },
    { name: 'getDeviceAnalytics', fn: analyticsService.getDeviceAnalytics },
    { name: 'getEnvironmentAnalytics', fn: analyticsService.getEnvironmentAnalytics },
    { name: 'getAlertAnalytics', fn: analyticsService.getAlertAnalytics },
  ];

  for (const s of services) {
    try {
      console.log(`Running ${s.name}...`);
      const result = await s.fn(query);
      console.log(`✅ ${s.name} succeeded! Keys:`, Object.keys(result));
    } catch (err) {
      console.error(`❌ ${s.name} failed! Error:`, err);
    }
  }
  process.exit(0);
}

testAllServices();
