// utils/helpers.js
// Extracted from duplicate trip mapping blocks (L248-269, L334-355, L387-408 in index.js)

const mapTripRow = (row) => {
  if (!row) return null;
  const get = (snake, camel) => (row[snake] !== undefined ? row[snake] : row[camel]);
  const num = (snake, camel) => {
    const v = get(snake, camel);
    return (v === undefined || v === null || v === '') ? 0 : Number(v);
  };
  const str = (snake, camel) => {
    const v = get(snake, camel);
    return (v === undefined || v === null) ? null : String(v);
  };
  const bool = (snake, camel) => get(snake, camel) === true || get(snake, camel) === 'true';

  const idleSeconds = num('idle_duration', 'idleDuration');
  const liveIdleTimeVal = get('live_idle_time', 'liveIdleTime') || (function() {
    const s = idleSeconds || 0;
    const h = Math.floor(s/3600);
    const m = Math.floor((s%3600)/60);
    const sec = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  })();

  return {
    id: get('id','id'),
    vehicle: get('vehicle','vehicle'),
    driver: get('driver','driver'),
    from: get('from_location','from'),
    to: get('to_location','to'),
    load: get('load','load'),
    client: get('client','client'),
    status: get('status','status'),
    ewayBill: str('eway_bill','ewayBill'),
    date: str('date','date'),
    progress: num('progress','progress'),
    distance: num('distance','distance'),
    fuelUsed: num('fuel_used','fuelUsed'),
    score: num('score','score'),
    delayMinutes: parseInt(get('delay_minutes','delayMinutes') || 0),
    waypoints: typeof get('waypoints','waypoints') === 'string' ? JSON.parse(get('waypoints','waypoints')) : (get('waypoints','waypoints') || []),
    tollCount: parseInt(get('toll_count','tollCount') || 0),
    liveSpeed: num('live_speed','liveSpeed'),
    power: get('power','power'),
    idleDuration: idleSeconds,
    tripCompleted: bool('trip_completed','tripCompleted'),
    defaultMileage: num('default_mileage','defaultMileage'),
    currentMileage: num('current_mileage','currentMileage'),
    fuelSaved: num('fuel_saved','fuelSaved'),
    fuelWasted: num('fuel_wasted','fuelWasted'),
    moneySaved: num('money_saved','moneySaved'),
    moneyWasted: num('money_wasted','moneyWasted'),
    liveIdleSpeed: num('live_idle_speed','liveIdleSpeed'),
    liveIdleTime: liveIdleTimeVal,
    liveFuelCount: num('live_fuel_count','liveFuelCount'),
    updatedAt: get('updated_at','updatedAt') ? (get('updated_at','updatedAt') instanceof Date ? get('updated_at','updatedAt').toISOString() : String(get('updated_at','updatedAt'))) : null,
    // removed legacy w1..w6 fields
  };
};

module.exports = {
  mapTripRow
};
