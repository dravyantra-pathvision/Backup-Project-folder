# Dynamic Mileage Calculation - Quick Start Guide

## Summary

The dynamic mileage and fuel consumption calculation system is now fully implemented and tested. The system automatically calculates fuel consumption based on vehicle speed and distance, with automatic recalculation whenever these values change.

## ✅ What's Implemented

### Core Functionality
- ✅ Enhanced speed-based mileage calculation (40-120+ km/h with graduated changes)
- ✅ Best efficiency at lower speeds (40-59 km/h = 5.0 km/l)
- ✅ Baseline at 60 km/h (4.0 km/l)
- ✅ Graduated degradation for higher speeds
- ✅ Automatic fuel_used calculation (distance ÷ current_mileage)
- ✅ Automatic recalculation when live_speed changes
- ✅ Automatic recalculation when distance changes
- ✅ Database persistence with synchronization
- ✅ Database trigger for additional safety layer
- ✅ Comprehensive test suites

### Calculation Rules Implemented
- **40-59 km/h**: 5.0 km/l (best efficiency - lower speed)
- **60 km/h**: 4.0 km/l (baseline)
- **70 km/h**: 3.6 km/l (10% reduction)
- **80 km/h**: 3.4 km/l (15% reduction)
- **90 km/h**: 3.2 km/l (20% reduction)
- **100 km/h**: 3.0 km/l (25% reduction)
- **110 km/h**: 2.8 km/l (30% reduction)
- **120+ km/h**: 2.6 km/l (35% reduction)

## 🚀 How to Use

### 1. **Create a Trip** with Speed and Distance

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "id": "trip-001",
    "vehicle": "DL01AB1234",
    "distance": 400,
    "liveSpeed": 50,
    "from": "Mumbai",
    "to": "Pune",
    "status": "running"
  }'
```

**Result**: 
- `current_mileage`: 5.0 km/l (BEST efficiency - 40-59 km/h range)
- `fuel_used`: 80 liters (400 ÷ 5.0)

### 2. **Update Live Speed** - Automatic Recalculation

```bash
curl -X PUT http://localhost:3000/api/trips/trip-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "liveSpeed": 80,
    "distance": 400
  }'
```

**Result**: 
- `current_mileage`: 3.4 km/l (auto-calculated)
- `fuel_used`: 117.65 liters (400 ÷ 3.4)

### 3. **Update Distance** - Automatic Recalculation

```bash
curl -X PUT http://localhost:3000/api/trips/trip-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "distance": 500
  }'
```

**Result**: 
- `current_mileage`: 3.4 km/l (unchanged)
- `fuel_used`: 147.06 liters (500 ÷ 3.4)

### 4. **Get Trips** - View All Calculated Values

```bash
curl http://localhost:3000/api/trips \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🧪 Testing

### Test 1: Database Calculations
```bash
cd backend
node tools/test_dynamic_mileage.js
```

Tests:
- ✓ Mileage calculation for all speed ranges
- ✓ Fuel calculation formulas
- ✓ Trip creation with auto-calculations
- ✓ Trip updates with recalculation
- ✓ Database trigger functionality

### Test 2: API Integration
```bash
# Terminal 1: Start the server
cd backend
npm start

# Terminal 2: Run API tests
cd backend
node tools/test_api_dynamic_calculations.js http://localhost:3000
```

Tests:
- ✓ Create trip via API
- ✓ Update trip with speed change
- ✓ Update trip with distance change
- ✓ Get trip and verify persistence

## 📊 Response Examples

### Create Trip Response
```json
{
  "id": "trip-001",
  "vehicle": "DL01AB1234",
  "distance": 400,
  "liveSpeed": 60,
  "live_speed": 60,
  "currentMileage": 4.0,
  "current_mileage": 4.0,
  "fuelUsed": 100,
  "fuel_used": 100,
  "fuelSaved": 0,
  "fuel_saved": 0,
  "fuelWasted": 0,
  "fuel_wasted": 0,
  "moneySaved": 0,
  "money_saved": 0,
  "moneyWasted": 0,
  "money_wasted": 0,
  "status": "running",
  "from": "Mumbai",
  "to": "Pune",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

### Update Trip Response (Speed Changed)
```json
{
  "id": "trip-001",
  "vehicle": "DL01AB1234",
  "distance": 400,
  "liveSpeed": 80,
  "live_speed": 80,
  "currentMileage": 3.4,
  "current_mileage": 3.4,
  "fuelUsed": 117.65,
  "fuel_used": 117.65,
  "fuelSaved": 0,
  "fuel_saved": 0,
  "fuelWasted": 17.65,
  "fuel_wasted": 17.65,
  ...
  "updatedAt": "2024-01-01T10:05:00Z"
}
```

## 🔧 Technical Details

### Files Modified/Created

1. **backend/services/tripService.js**
   - Updated `getCurrentMileageFromSpeed()` function
   - Ensured consistent calculation logic

2. **backend/config/dbconfig.js**
   - Updated trigger `compute_idle_money_wasted()`
   - Added comprehensive comments

3. **backend/tools/test_dynamic_mileage.js** (NEW)
   - Database-level tests
   - Formula verification
   - Trigger functionality tests

4. **backend/tools/test_api_dynamic_calculations.js** (NEW)
   - API integration tests
   - Real request/response verification
   - End-to-end workflow testing

5. **backend/DYNAMIC_MILEAGE_IMPLEMENTATION.md** (NEW)
   - Comprehensive technical documentation
   - Implementation guide
   - Troubleshooting reference

## 📋 Verification Checklist

- [x] Low-speed efficiency (40-59 km/h = 5.0 km/l) working
- [x] Speed-to-mileage mapping is correct
- [x] Fuel calculation formula is correct
- [x] Automatic recalculation on speed change
- [x] Automatic recalculation on distance change
- [x] Database persistence working
- [x] Trigger redundancy handled
- [x] API endpoints working
- [x] Response format consistent
- [x] Test cases comprehensive
- [x] Documentation complete

## ⚡ Key Features

1. **Automatic Calculation**: No manual input needed for mileage or fuel
2. **Real-time Updates**: Changes to speed/distance immediately trigger recalculation
3. **Database Synchronization**: All values persisted and retrievable
4. **Dual Layer Safety**: Both service layer and database trigger perform calculations
5. **Throttled Updates**: Prevents excessive updates (1000ms minimum between updates per trip)
6. **Field Compatibility**: Both camelCase and snake_case field names supported

## 🚨 Important Notes

1. **Live Speed Required**: Ensure `liveSpeed` is always provided when creating trips
2. **Default Distance**: If distance is not provided, defaults to 0
3. **Manual Override**: Trips with `manual_override=true` will not be updated
4. **Stale Updates**: Updates with old timestamps will be rejected
5. **Request Throttling**: Max 1 update per 1000ms per trip ID

## 📞 Support & Debugging

### Common Issues & Solutions

**Issue**: Fuel calculations not matching expected values
- **Check**: Verify live_speed value in request
- **Check**: Ensure distance is a valid number
- **Check**: Review the speed-to-mileage mapping table

**Issue**: Updates not working
- **Check**: Confirm trip exists and belongs to user
- **Check**: Wait 1 second between updates (throttle limit)
- **Check**: Verify no "Stale update" error in response

**Issue**: Database trigger not firing
- **Check**: Run `node tools/test_dynamic_mileage.js` to verify trigger
- **Check**: Check PostgreSQL logs for errors
- **Check**: Ensure trigger is created with `psql`: `SELECT * FROM pg_trigger WHERE tgname = 'trips_compute_idle_money_wasted';`

## 📖 Documentation

For detailed technical information, see:
- [DYNAMIC_MILEAGE_IMPLEMENTATION.md](./DYNAMIC_MILEAGE_IMPLEMENTATION.md) - Complete technical guide
- [tripService.js](./services/tripService.js) - Service implementation
- [dbconfig.js](./config/dbconfig.js) - Database schema and triggers
- [tripController.js](./controllers/tripController.js) - API controller

## ✨ Ready to Use!

The dynamic mileage and fuel consumption calculation system is fully functional and tested. All requirements have been implemented:

- ✅ 60 km/h baseline with 4 km/l mileage
- ✅ Speed-based reductions (70→10%, 80→15%, etc.)
- ✅ Dynamic fuel_used calculation (distance ÷ current_mileage)
- ✅ Automatic recalculation on live_speed changes
- ✅ Automatic recalculation on distance changes
- ✅ Database persistence and synchronization
- ✅ Comprehensive testing and documentation

The system is production-ready and handles all edge cases correctly. 🎉
