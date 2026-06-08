# Fuel Saved & Money Saved - Quick Reference Guide

## Overview

The system automatically calculates **fuel saved** and **money saved** for each trip based on the actual fuel efficiency achieved compared to the baseline efficiency of **3.5 km/l**.

## Key Concept

- **Baseline Mileage**: 3.5 km/l (constant, system-wide)
- **Comparison**: Trip's actual current_mileage vs. the baseline
- **Result**: 
  - If actual mileage > 3.5 → fuel_saved shows the benefit
  - If actual mileage ≤ 3.5 → fuel_saved = 0 (no savings to report)

## Calculation Formula

```
baseline_fuel_consumed = distance / 3.5
actual_fuel_consumed = distance / current_mileage

IF current_mileage > 3.5 km/l:
    fuel_saved = baseline_fuel_consumed - actual_fuel_consumed
    money_saved = fuel_saved × fuel_price_per_liter
ELSE:
    fuel_saved = 0
    money_saved = 0
```

## Real-World Examples

### Example 1: Good Efficiency (Lower Speed - 50 km/h)
```
Trip Details:
- Distance: 350 km
- Speed: 50 km/h → Current Mileage: 4.38 km/l
- Fuel Price: ₹100 per liter

Calculations:
- Baseline: 350 ÷ 3.5 = 100 L
- Actual: 350 ÷ 4.38 = 79.91 L
- Fuel Saved: 100 - 79.91 = 20.09 L ✓
- Money Saved: 20.09 × 100 = ₹2,009 ✓
```

### Example 2: Poor Efficiency (Higher Speed - 100 km/h)
```
Trip Details:
- Distance: 350 km
- Speed: 100 km/h → Current Mileage: 2.63 km/l
- Fuel Price: ₹100 per liter

Calculations:
- Baseline: 350 ÷ 3.5 = 100 L
- Actual: 350 ÷ 2.63 = 133.08 L
- Current Mileage (2.63) < Baseline (3.5) → No Savings
- Fuel Saved: 0 L (condition not met)
- Money Saved: ₹0 (condition not met)
```

### Example 3: Optimal Efficiency (Very Low Speed - 40 km/h)
```
Trip Details:
- Distance: 400 km
- Speed: 40 km/h → Current Mileage: 4.38 km/l
- Fuel Price: ₹120 per liter

Calculations:
- Baseline: 400 ÷ 3.5 = 114.29 L
- Actual: 400 ÷ 4.38 = 91.32 L
- Fuel Saved: 114.29 - 91.32 = 22.97 L ✓
- Money Saved: 22.97 × 120 = ₹2,756.40 ✓
```

## Speed-to-Mileage Mapping

The system automatically calculates `current_mileage` based on speed:

| Speed Range | Current Mileage | Status |
|---|---|---|
| 40-59 km/h | 4.38 km/l | ✓ Saves fuel |
| 60-69 km/h | 3.5 km/l | = Baseline |
| 70-79 km/h | 3.15 km/l | ✗ Uses more fuel |
| 80-89 km/h | 2.98 km/l | ✗ Uses more fuel |
| 90-99 km/h | 2.8 km/l | ✗ Uses more fuel |
| 100-109 km/h | 2.63 km/l | ✗ Uses more fuel |
| 110-119 km/h | 2.45 km/l | ✗ Uses more fuel |
| 120+ km/h | 2.28 km/l | ✗ Uses more fuel |

## Automatic Recalculation

The system **automatically recalculates** fuel_saved and money_saved whenever any of these fields change:

1. **Distance** - If trip distance is updated
2. **Live Speed** - If vehicle speed changes (updates current_mileage)
3. **Fuel Price Per Liter** - If fuel price is adjusted

### Example: Distance Update

```
Initial State:
- Distance: 350 km, Speed: 50 km/h (4.38 km/l), Fuel Price: ₹100/l
- Fuel Saved: 20.09 L, Money Saved: ₹2,009

After Update (Distance → 700 km):
- Baseline: 700 ÷ 3.5 = 200 L
- Actual: 700 ÷ 4.38 = 159.82 L
- Fuel Saved: 40.18 L ✓ (doubled)
- Money Saved: ₹4,018 ✓ (doubled)
```

## API Usage

### Create Trip with Fuel Savings Calculation

```bash
curl -X POST http://localhost:3000/api/trips \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "id": "trip-001",
    "vehicle": "TRK-001",
    "distance": 350,
    "liveSpeed": 50,
    "fuelPricePerLiter": 100,
    "status": "running"
  }'
```

**Response** (includes auto-calculated values):
```json
{
  "id": "trip-001",
  "distance": 350,
  "live_speed": 50,
  "current_mileage": 4.38,
  "fuel_used": 79.91,
  "fuel_saved": 20.09,
  "money_saved": 2009,
  "fuel_price_per_liter": 100,
  ...
}
```

### Update Trip (Automatic Recalculation)

```bash
curl -X PUT http://localhost:3000/api/trips/trip-001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "distance": 700
  }'
```

**Response** (fuel_saved and money_saved automatically recalculated):
```json
{
  "distance": 700,
  "fuel_saved": 40.18,
  "money_saved": 4018,
  ...
}
```

## Edge Cases Handled

### Zero Distance
```
- Distance: 0 km
- fuel_used: 0 L
- fuel_saved: 0 L
- money_saved: ₹0
```

### Missing Fields (Uses Defaults)
```
- fuel_price_per_liter: Not provided → Uses ₹100/l (default)
- live_speed: 0 → current_mileage = 3.5 km/l
```

### Negative Prevention
- If any calculation results in negative: stored as 0
- Money saved can never be negative
- Fuel saved can never be negative

## Technical Implementation

### Database Layer
- **Column**: `fuel_price_per_liter` (DOUBLE PRECISION, default 100.0)
- **Trigger**: `compute_idle_money_wasted()` in PostgreSQL
- **Execution**: BEFORE INSERT OR UPDATE on trips table

### Service Layer
- **Functions**: `createTrip()`, `updateTrip()` in tripService.js
- **Recalculation**: Happens automatically on every INSERT/UPDATE
- **Dual-layer**: Service calculates, trigger validates and recalculates

## Benefits

1. **Automatic Tracking** - No manual entry needed
2. **Consistent Comparison** - All trips compared against same 3.5 km/l baseline
3. **Financial Insight** - See rupee value of fuel efficiency
4. **Performance Monitoring** - Identify driver/speed efficiency patterns
5. **Cost Optimization** - Data-driven decisions for route planning and speed management

## Monitoring & Analytics

Use these queries to analyze fuel savings:

```sql
-- Total fuel saved across all trips
SELECT SUM(fuel_saved) as total_fuel_saved FROM trips WHERE uid = $1;

-- Total money saved
SELECT SUM(money_saved) as total_money_saved FROM trips WHERE uid = $1;

-- Average fuel saved per trip
SELECT AVG(fuel_saved) as avg_fuel_saved FROM trips WHERE uid = $1;

-- Trips with best fuel savings
SELECT id, distance, current_mileage, fuel_saved, money_saved 
FROM trips WHERE uid = $1 
ORDER BY fuel_saved DESC LIMIT 10;
```

## Troubleshooting

**Q: Why is fuel_saved = 0 even though I'm driving at 50 km/h?**
- A: Check that `current_mileage` is > 3.5. Use `SELECT live_speed, current_mileage FROM trips WHERE id = 'trip-id'` to verify.

**Q: Money saved seems wrong. Is fuel_price_per_liter set?**
- A: Verify with: `SELECT fuel_saved, money_saved, fuel_price_per_liter FROM trips WHERE id = 'trip-id'`
- Formula: money_saved = fuel_saved × fuel_price_per_liter

**Q: Calculations not updating after distance change?**
- A: The trigger fires on UPDATE. If issue persists, check database logs for trigger errors.

---

**Last Updated**: 2 June 2026  
**Test Status**: ✅ All 6 test cases passing  
**Production Ready**: Yes
