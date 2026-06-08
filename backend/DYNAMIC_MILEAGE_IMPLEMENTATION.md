# Dynamic Mileage & Fuel Consumption Implementation Guide

## Overview

This document explains the dynamic mileage and fuel consumption calculation system implemented in the DravYantra backend. The system automatically calculates fuel consumption based on vehicle speed and distance traveled.

## Architecture

### Key Components

1. **Service Layer** (`backend/services/tripService.js`)
   - Handles trip creation and updates
   - Calculates mileage based on current speed
   - Calculates fuel consumption based on distance and mileage
   - Persists calculations to database

2. **Database Layer** (`backend/config/dbconfig.js`)
   - PostgreSQL database with trips table
   - Trigger function `compute_idle_money_wasted()` for additional safety
   - Automatic recalculation on INSERT/UPDATE operations

3. **API Layer** (`backend/controllers/tripController.js`)
   - Exposes REST endpoints for trip management
   - Routes to service layer for calculations

## Calculation Logic

### Speed-to-Mileage Mapping

The system uses a graduated efficiency model where lower speeds provide better fuel efficiency, and higher speeds reduce efficiency:

| Speed (km/h) | Mileage (km/l) | Efficiency Gain/Loss | Note |
|---|---|---|---|
| 40-59 | 5.0 | +25% (best) | BEST EFFICIENCY - Lower speeds |
| 60-69 | 4.0 | 0% (baseline) | Baseline efficiency |
| 70-79 | 3.6 | -10% | 10% degradation |
| 80-89 | 3.4 | -15% | 15% degradation |
| 90-99 | 3.2 | -20% | 20% degradation |
| 100-109 | 3.0 | -25% | 25% degradation |
| 110-119 | 2.8 | -30% | 30% degradation |
| 120+ | 2.6 | -35% | Worst efficiency |

**Formula**: 
```
if speed is 40-59 km/h:
  current_mileage = 5.0 km/l (best efficiency)
else if speed <= 60:
  current_mileage = 4.0 km/l (baseline)
else:
  current_mileage = baseline * (1 - efficiency_loss_percentage)
```

### Fuel Consumption Calculation

**Formula**:
```
fuel_used = distance / current_mileage
```

**Examples**:
- Distance: 400 km, Speed: 50 km/h (low speed - best efficiency)
  - Mileage: 5.0 km/l
  - Fuel Used: 400 ÷ 5.0 = 80 liters (BEST - saves 20 liters vs baseline!)

- Distance: 400 km, Speed: 60 km/h (baseline)
  - Mileage: 4.0 km/l
  - Fuel Used: 400 ÷ 4.0 = 100 liters

- Distance: 400 km, Speed: 70 km/h
  - Mileage: 3.6 km/l
  - Fuel Used: 400 ÷ 3.6 = 111.11 liters

- Distance: 400 km, Speed: 80 km/h
  - Mileage: 3.4 km/l
  - Fuel Used: 400 ÷ 3.4 = 117.65 liters

- Distance: 400 km, Speed: 120 km/h (high speed - worst efficiency)
  - Mileage: 2.6 km/l
  - Fuel Used: 400 ÷ 2.6 = 153.85 liters (wastes 53.85 liters vs baseline!)

## Data Flow

### Trip Creation Flow

```
1. Client sends POST /api/trips with:
   - distance
   - liveSpeed (current_speed)
   - other trip details

2. Controller: tripController.createTrip()
   - Validates input
   - Throttles requests (1000ms minimum interval per trip)

3. Service: tripService.createTrip()
   - Reads live_speed from request
   - Calls getCurrentMileageFromSpeed(liveSpeed)
   - For 40-59 km/h: returns 5.0 km/l (best efficiency)
   - For 60 km/h: returns 4.0 km/l (baseline)
   - For >60 km/h: applies graduated reductions
   - Calculates fuel_used = distance / current_mileage
   - Calculates fuel_saved, fuel_wasted, money_saved, money_wasted
   - Prepares INSERT query with calculated values

4. Database: INSERT with ON CONFLICT DO UPDATE
   - Trigger fires BEFORE INSERT/UPDATE
   - Trigger recalculates current_mileage and fuel_used
   - INSERT/UPDATE completes with service-calculated values

5. Response: Returns trip object with all calculated fields
```

### Trip Update Flow

```
1. Client sends PUT /api/trips/:id with:
   - liveSpeed (optional - if changed)
   - distance (optional - if changed)
   - other fields (optional)

2. Controller: tripController.updateTrip()
   - Validates trip ownership
   - Throttles requests (1000ms minimum interval per trip)

3. Service: tripService.updateTrip()
   - Reads current trip from database
   - Uses provided values or falls back to database values
   - Recalculates current_mileage and fuel_used
   - Calculates related metrics (fuel_saved, fuel_wasted, etc.)
   - Prepares UPDATE query with recalculated values

4. Database: UPDATE operation
   - Trigger fires BEFORE UPDATE
   - Trigger recalculates fields
   - UPDATE completes with service-calculated values

5. Sync Vehicle Speed:
   - Updates vehicles table with new speed
   - Clears speed if trip marked as completed

6. Response: Returns updated trip object
```

## Automatic Recalculation Triggers

The system automatically recalculates fuel consumption when:

1. **Live Speed Changes**
   - API: `PUT /api/trips/:id` with new `liveSpeed`
   - Effect: `current_mileage` recalculated, `fuel_used` recalculated

2. **Distance Changes**
   - API: `PUT /api/trips/:id` with new `distance`
   - Effect: `fuel_used` recalculated based on distance and existing mileage

3. **Trip Created/Updated**
   - Both `live_speed` and `distance` are always recalculated
   - All dependent metrics (fuel_saved, fuel_wasted, etc.) are recalculated

## Implementation Details

### In-Service Calculation (tripService.js)

```javascript
// Step 1: Get current mileage based on speed
const currentMileage = getCurrentMileageFromSpeed(liveSpeed);

// Step 2: Calculate fuel used
const fuelUsed = (distance > 0 && currentMileage > 0) 
  ? Number((distance / currentMileage).toFixed(2)) 
  : 0.0;

// Step 3: Calculate fuel saved (against expected fuel at baseline)
const expectedFuel = defaultMileage > 0 ? distance / defaultMileage : 0.0;
const fuelSaved = Math.max(0, expectedFuel - fuelUsed);

// Step 4: Calculate fuel wasted
const fuelWastedMileage = Math.max(0, fuelUsed - expectedFuel);
const idleLiters = fuelPrice > 0 ? idleRupees / fuelPrice : 0.0;
const fuelWasted = fuelWastedMileage + idleLiters;
```

### Database Trigger (dbconfig.js)

```sql
CREATE OR REPLACE FUNCTION compute_idle_money_wasted()
RETURNS trigger AS $$
BEGIN
  -- Recalculate mileage based on speed
  NEW.current_mileage := CASE
    WHEN COALESCE(NEW.live_speed, 0) <= 60 THEN 4.0
    WHEN NEW.live_speed < 70 THEN 4.0
    ... (speed ranges) ...
  END;
  
  -- Recalculate fuel used
  NEW.fuel_used := CASE
    WHEN COALESCE(NEW.distance, 0) > 0 AND NEW.current_mileage > 0 
      THEN ROUND((NEW.distance / NEW.current_mileage)::numeric, 2)
    ELSE 0.0
  END;
  
  -- Recalculate idle money wasted
  NEW.idle_money_wasted := ROUND(COALESCE(NEW.total_idle_time, 0) * 1.7::numeric, 2);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## API Endpoints

### Create Trip
```
POST /api/trips
Content-Type: application/json
Authorization: Bearer <token>

{
  "id": "trip-123",
  "vehicle": "DL01AB1234",
  "distance": 400,
  "liveSpeed": 70,
  "from": "Mumbai",
  "to": "Pune",
  "status": "running"
}

Response:
{
  "id": "trip-123",
  "vehicle": "DL01AB1234",
  "distance": 400,
  "liveSpeed": 70,
  "live_speed": 70,
  "currentMileage": 3.6,
  "current_mileage": 3.6,
  "fuelUsed": 111.11,
  "fuel_used": 111.11,
  ...
}
```

### Update Trip
```
PUT /api/trips/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "liveSpeed": 80,
  "distance": 450
}

Response:
{
  "id": "trip-123",
  ...
  "liveSpeed": 80,
  "live_speed": 80,
  "currentMileage": 3.4,
  "current_mileage": 3.4,
  "fuelUsed": 132.35,
  "fuel_used": 132.35,
  ...
}
```

### Get Trips
```
GET /api/trips
Authorization: Bearer <token>

Response:
[
  {
    "id": "trip-123",
    "currentMileage": 3.4,
    "fuelUsed": 132.35,
    ...
  },
  ...
]
```

## Response Field Mapping

The API returns both camelCase and snake_case versions of fields for compatibility:

| Service/API | Database | Description |
|---|---|---|
| `liveSpeed` / `live_speed` | `live_speed` | Current vehicle speed (km/h) |
| `currentMileage` / `current_mileage` | `current_mileage` | Calculated mileage based on speed (km/l) |
| `fuelUsed` / `fuel_used` | `fuel_used` | Calculated fuel consumption (liters) |
| `fuelSaved` / `fuel_saved` | `fuel_saved` | Fuel saved vs baseline (liters) |
| `fuelWasted` / `fuel_wasted` | `fuel_wasted` | Fuel wasted vs baseline (liters) |
| `moneySaved` / `money_saved` | `money_saved` | Money saved from efficiency (rupees) |
| `moneyWasted` / `money_wasted` | `money_wasted` | Money wasted from inefficiency (rupees) |

## Testing

### Test Database Calculations
```bash
cd backend
node tools/test_dynamic_mileage.js
```

Output:
```
=== Testing Mileage Calculation ===
✓ 60 km/h → 4.0 km/l (baseline)
✓ 70 km/h → 3.6 km/l (10% reduction)
✓ 80 km/h → 3.4 km/l (15% reduction)
...

=== Testing Fuel Consumption Calculation ===
✓ 400 km ÷ 4.0 km/l = 100 l
✓ 400 km ÷ 3.6 km/l = 111.11 l
✓ 400 km ÷ 3.4 km/l = 117.65 l
...
```

### Test API Integration
```bash
cd backend

# Start the server first
npm start &

# Run API tests
node tools/test_api_dynamic_calculations.js http://localhost:3000
```

## Database Schema

Key columns in the `trips` table:

```sql
CREATE TABLE trips (
  id VARCHAR(50) PRIMARY KEY,
  uid VARCHAR(128) REFERENCES users(uid),
  
  -- Input values
  vehicle VARCHAR(50),
  distance DOUBLE PRECISION,        -- km
  live_speed DOUBLE PRECISION,      -- km/h
  
  -- Calculated values
  current_mileage DOUBLE PRECISION, -- km/l (auto-calculated)
  fuel_used DOUBLE PRECISION,       -- liters (auto-calculated)
  default_mileage DOUBLE PRECISION, -- baseline mileage (4.0 km/l)
  fuel_saved DOUBLE PRECISION,      -- liters
  fuel_wasted DOUBLE PRECISION,     -- liters
  money_saved DOUBLE PRECISION,     -- rupees
  money_wasted DOUBLE PRECISION,    -- rupees
  
  -- Timestamps
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  
  ...other fields...
);
```

## Edge Cases Handled

1. **Zero Distance**: fuel_used = 0
2. **Zero Speed**: Uses baseline mileage (4.0 km/l)
3. **Null Values**: Treated as 0
4. **Manual Override**: Trips with `manual_override=true` are not updated
5. **Stale Updates**: Rejected if database has newer version
6. **Concurrent Updates**: Request throttled (min 1000ms between updates per trip)

## Performance Considerations

1. **Request Throttling**: 1000ms minimum interval between updates for same trip
2. **Calculation Efficiency**: All calculations in-memory (O(1) complexity)
3. **Database Indexes**: Recommended on `uid`, `vehicle`, `id`
4. **Trigger Overhead**: Minimal - only performs simple CASE calculations

## Future Enhancements

1. Add configurable speed-to-mileage mapping per vehicle type
2. Implement historical fuel efficiency trending
3. Add real-time efficiency alerts
4. Support for custom fuel price calculation
5. Integration with real GPS speed data

## Troubleshooting

### Issue: fuel_used not updating when liveSpeed changes

**Solution**: 
- Verify live_speed is being sent in UPDATE request
- Check that request is using PUT (not PATCH)
- Ensure updated_at timestamp is not causing stale update error

### Issue: Calculations seem incorrect

**Solution**:
- Verify the speed-to-mileage mapping in getCurrentMileageFromSpeed()
- Check if trip has manual_override=true (which prevents updates)
- Review database trigger to ensure it's enabled

### Issue: Vehicle speed not syncing

**Solution**:
- Ensure vehicle exists in vehicles table
- Check that vehicle plate matches exactly
- Verify no permission issues on UPDATE

## Support

For issues or questions about the dynamic mileage calculation system, refer to:
- Implementation: `backend/services/tripService.js`
- Database Setup: `backend/config/dbconfig.js`
- API Routes: `backend/routes/tripRoutes.js`
- Tests: `backend/tools/test_dynamic_mileage.js`, `backend/tools/test_api_dynamic_calculations.js`
