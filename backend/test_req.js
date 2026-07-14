const analyticsService = require('./modules/admin/analytics.service');

async function testFailedFilter() {
  const query = {
    organization_id: '7dLwA1Lvf3RuL81l8aS6X3BSqH63',
    driver_id: 'anand',
    from_date: '2026-07-06',
    to_date: '2026-07-06'
  };

  try {
    console.log('Testing overview with org + driver filter...');
    const overview = await analyticsService.getOverview(query);
    console.log('✅ Overview success! Result:', overview);

    console.log('Testing device analytics with org + driver filter...');
    const devices = await analyticsService.getDeviceAnalytics(query);
    console.log('✅ Devices success! Result:', devices);

    console.log('Testing driver analytics with org + driver filter...');
    const drivers = await analyticsService.getDriverAnalytics(query);
    console.log('✅ Drivers success! Result:', drivers);

  } catch (err) {
    console.error('❌ Failed! Error:', err);
  }
  process.exit(0);
}

testFailedFilter();
