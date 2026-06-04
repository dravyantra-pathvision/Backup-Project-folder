# Speed Efficiency Comparison Chart

## Fuel Consumption for 400 km Trip at Different Speeds

This chart shows how fuel consumption changes based on vehicle speed with the dynamic mileage calculation system.

### Complete Comparison

| Speed (km/h) | Mileage (km/l) | Fuel Used (L) | vs Baseline | Savings/Waste |
|---|---|---|---|---|
| **40** | **5.0** | **80** | **-20%** | **💚 SAVE 20 L** |
| **50** | **5.0** | **80** | **-20%** | **💚 SAVE 20 L** |
| **60** | 4.0 | 100 | 0% (baseline) | — |
| **70** | 3.6 | 111.11 | +11% | 🔴 WASTE 11 L |
| **80** | 3.4 | 117.65 | +18% | 🔴 WASTE 18 L |
| **90** | 3.2 | 125 | +25% | 🔴 WASTE 25 L |
| **100** | 3.0 | 133.33 | +33% | 🔴 WASTE 33 L |
| **110** | 2.8 | 142.86 | +43% | 🔴 WASTE 43 L |
| **120** | 2.6 | 153.85 | +54% | 🔴 WASTE 54 L |

### Key Insights

#### 💚 **Best Efficiency Zone: 40-59 km/h**
- **Mileage**: 5.0 km/l (25% better than baseline!)
- **For 400 km trip**: 80 liters (saves 20 liters)
- **For 1000 km trip**: 200 liters (saves 50 liters)
- **Cost savings at ₹100/L**: ₹2000 per 1000 km!

#### ⚠️ **Speed Impact Examples**

**Example 1: City Route at 50 km/h**
```
Distance: 400 km
Speed: 50 km/h
Mileage: 5.0 km/l
Fuel Used: 80 liters ← BEST!
```

**Example 2: Highway at 60 km/h (baseline)**
```
Distance: 400 km
Speed: 60 km/h
Mileage: 4.0 km/l
Fuel Used: 100 liters
```

**Example 3: High-speed Highway at 80 km/h**
```
Distance: 400 km
Speed: 80 km/h
Mileage: 3.4 km/l
Fuel Used: 117.65 liters ← 18% MORE fuel!
```

**Example 4: Very High Speed at 120 km/h**
```
Distance: 400 km
Speed: 120 km/h
Mileage: 2.6 km/l
Fuel Used: 153.85 liters ← 54% MORE fuel!
```

### Real-World Scenarios

#### Scenario A: One-day Delivery Route
```
Route Type: City delivery (stop-and-go, avg speed: 50 km/h)
Total Distance: 500 km
Current Mileage: 5.0 km/l
Fuel Used: 100 liters

vs High-speed Highway (80 km/h):
Current Mileage: 3.4 km/l
Fuel Used: 147 liters
DIFFERENCE: +47 liters extra fuel needed!
```

#### Scenario B: Long-Distance Interstate Haul
```
Route Type: Highway (avg speed: 80 km/h)
Total Distance: 1000 km
Current Mileage: 3.4 km/l
Fuel Used: 294 liters
Fuel Cost: ₹29,400

If Driver Maintained 60 km/h:
Fuel Used: 250 liters (saves 44 liters)
Fuel Cost: ₹25,000 (saves ₹4,400)
Travel Time: +4-5 hours (for 44L savings)
```

#### Scenario C: Mixed Route
```
Morning (50 km at 50 km/h - city):
  Mileage: 5.0 km/l
  Fuel: 10 liters

Afternoon (150 km at 80 km/h - highway):
  Mileage: 3.4 km/l
  Fuel: 44.12 liters

Total: 200 km, 54.12 liters consumed
Average effective mileage: 3.69 km/l
```

### Cost Analysis (assuming ₹100/L fuel)

#### 1000 km Journey

| Speed | Fuel (L) | Cost (₹) | vs 60 km/h |
|---|---|---|---|
| **50 km/h** | 200 | ₹20,000 | **Saves ₹5,000** |
| 60 km/h | 250 | ₹25,000 | Baseline |
| 70 km/h | 278 | ₹27,800 | Costs ₹2,800 more |
| 80 km/h | 294 | ₹29,400 | Costs ₹4,400 more |
| 90 km/h | 313 | ₹31,300 | Costs ₹6,300 more |
| 120 km/h | 385 | ₹38,500 | Costs ₹13,500 more |

### Optimization Tips

#### To Maximize Fuel Efficiency 💚
1. ✅ Maintain 40-59 km/h speed for best mileage
2. ✅ Avoid speeds above 80 km/h on long routes
3. ✅ Plan city routes at lower speeds (50-59 km/h)
4. ✅ Consider travel time vs. fuel cost trade-off

#### When to Accept Higher Fuel Consumption
1. ⏱️ Time-sensitive deliveries requiring 80+ km/h
2. 🛣️ Long highways where slower speeds are impractical
3. ⚠️ Safety concerns requiring optimal speed for conditions

#### Driver Incentives
- **Reward**: Drivers maintaining 40-59 km/h = 25% fuel savings
- **Penalty**: Drivers exceeding 100 km/h = 33%+ fuel waste
- **Bonus**: Consistent eco-driving (avg 55 km/h) = 20% savings

### Automatic Recalculation Examples

The system automatically updates fuel consumption when speed changes:

#### Trip Update Sequence
```
1. Trip starts at 60 km/h, 400 km distance
   → fuel_used = 100 liters
   → current_mileage = 4.0 km/l

2. Speed increases to 80 km/h (same distance)
   → fuel_used AUTO-RECALCULATES to 117.65 liters
   → current_mileage AUTO-RECALCULATES to 3.4 km/l
   → +17.65 liters extra consumption

3. Speed decreases to 50 km/h
   → fuel_used AUTO-RECALCULATES to 80 liters
   → current_mileage AUTO-RECALCULATES to 5.0 km/l
   → -20 liters savings!
```

### Database Examples

#### Trip at 50 km/h (Best Efficiency)
```json
{
  "id": "trip-001",
  "distance": 400,
  "liveSpeed": 50,
  "currentMileage": 5.0,
  "fuelUsed": 80,
  "fuelSaved": 50,
  "fuelWasted": 0,
  "moneySaved": 5000,
  "moneyWasted": 0
}
```

#### Same Trip at 80 km/h
```json
{
  "id": "trip-001",
  "distance": 400,
  "liveSpeed": 80,
  "currentMileage": 3.4,
  "fuelUsed": 117.65,
  "fuelSaved": 0,
  "fuelWasted": 17.65,
  "moneySaved": 0,
  "moneyWasted": 1765
}
```

### Summary

The dynamic mileage calculation system rewards eco-driving:

- ✅ **Best**: 40-59 km/h → 5.0 km/l (20-25% savings)
- ⚠️ **Good**: 60-70 km/h → 4.0-3.6 km/l (baseline to 11% waste)
- 🔴 **Poor**: 80+ km/h → 3.4 km/l or worse (18%+ waste)
- 🔴 **Worst**: 120+ km/h → 2.6 km/l (54% waste)

**Result**: A 50 km/h vehicle saves 20 liters per 400 km compared to a 120 km/h vehicle. On a 1000 km route, that's a **₹5,000 difference in fuel costs!**
