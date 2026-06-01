const tripService = require('../services/tripService');
(async ()=>{
  try{
    const res = await tripService.updateTrip('default_user','TRP-4406',{idleDuration:5, liveIdleTime:'00:00:05'});
    console.log('update result', res);
  }catch(e){
    console.error('update error', e && e.stack ? e.stack : e);
  } finally {
    process.exit(0);
  }
})();
