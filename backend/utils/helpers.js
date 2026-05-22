// utils/helpers.js
// Extracted from duplicate trip mapping blocks (L248-269, L334-355, L387-408 in index.js)

const mapTripRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    vehicle: row.vehicle,
    driver: row.driver,
    from: row.from_location,
    to: row.to_location,
    load: row.load,
    client: row.client,
    status: row.status,
    ewayBill: row.eway_bill,
    date: row.date,
    progress: parseFloat(row.progress) || 0.0,
    distance: parseFloat(row.distance) || 0.0,
    fuelUsed: parseFloat(row.fuel_used) || 0.0,
    score: parseFloat(row.score) || 0.0,
    delayMinutes: parseInt(row.delay_minutes) || 0,
    waypoints: typeof row.waypoints === 'string' ? JSON.parse(row.waypoints) : (row.waypoints || []),
    tollCount: parseInt(row.toll_count) || 0,
    liveSpeed: parseFloat(row.live_speed) || 0.0,
    power: row.power,
    idleDuration: parseInt(row.idle_duration) || 0,
    tripCompleted: row.trip_completed === true
    ,
    defaultMileage: parseFloat(row.default_mileage) || 0.0,
    currentMileage: parseFloat(row.current_mileage) || 0.0,
    fuelSaved: parseFloat(row.fuel_saved) || 0.0,
    fuelWasted: parseFloat(row.fuel_wasted) || 0.0,
    moneySaved: parseFloat(row.money_saved) || 0.0,
    moneyWasted: parseFloat(row.money_wasted) || 0.0
  };
};

module.exports = {
  mapTripRow
};
