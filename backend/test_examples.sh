#!/bin/bash
# test_examples.sh - Example curl commands for testing dynamic mileage calculations

# ============================================
# Configuration
# ============================================
API_URL="http://localhost:3000"
TOKEN="your-auth-token-here"
TRIP_ID="trip-$(date +%s)"
VEHICLE_PLATE="DL01AB1234"

echo "═══════════════════════════════════════════════════════════"
echo "Dynamic Mileage & Fuel Consumption - Test Examples"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "API URL: $API_URL"
echo "Test Trip ID: $TRIP_ID"
echo ""

# ============================================
# Example 1: Create Trip at 60 km/h (baseline)
# ============================================
echo "📝 [Example 1] Creating trip at 60 km/h with 400 km distance"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "curl -X POST $API_URL/api/trips \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -d '{"
echo "    \"id\": \"$TRIP_ID\","
echo "    \"vehicle\": \"$VEHICLE_PLATE\","
echo "    \"distance\": 400,"
echo "    \"liveSpeed\": 60,"
echo "    \"from\": \"Start Point\","
echo "    \"to\": \"End Point\","
echo "    \"status\": \"running\""
echo "  }'"
echo ""
echo "Expected Result:"
echo "  - current_mileage: 4.0 km/l"
echo "  - fuel_used: 100 liters"
echo ""
echo "Formula: 400 km ÷ 4.0 km/l = 100 liters"
echo ""

# ============================================
# Example 2: Update Trip Speed to 70 km/h
# ============================================
echo "📝 [Example 2] Updating trip speed to 70 km/h"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "curl -X PUT $API_URL/api/trips/$TRIP_ID \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -d '{"
echo "    \"liveSpeed\": 70,"
echo "    \"distance\": 400"
echo "  }'"
echo ""
echo "Expected Result:"
echo "  - current_mileage: 3.6 km/l (10% reduction)"
echo "  - fuel_used: 111.11 liters"
echo ""
echo "Formula: 400 km ÷ 3.6 km/l = 111.11 liters"
echo ""

# ============================================
# Example 3: Update Trip Speed to 80 km/h
# ============================================
echo "📝 [Example 3] Updating trip speed to 80 km/h"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "curl -X PUT $API_URL/api/trips/$TRIP_ID \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -d '{"
echo "    \"liveSpeed\": 80,"
echo "    \"distance\": 400"
echo "  }'"
echo ""
echo "Expected Result:"
echo "  - current_mileage: 3.4 km/l (15% reduction)"
echo "  - fuel_used: 117.65 liters"
echo ""
echo "Formula: 400 km ÷ 3.4 km/l = 117.65 liters"
echo ""

# ============================================
# Example 4: Update Trip Distance
# ============================================
echo "📝 [Example 4] Updating trip distance to 500 km (keeping 80 km/h speed)"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "curl -X PUT $API_URL/api/trips/$TRIP_ID \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer $TOKEN' \\"
echo "  -d '{"
echo "    \"distance\": 500"
echo "  }'"
echo ""
echo "Expected Result:"
echo "  - current_mileage: 3.4 km/l (unchanged)"
echo "  - fuel_used: 147.06 liters"
echo ""
echo "Formula: 500 km ÷ 3.4 km/l = 147.06 liters"
echo ""

# ============================================
# Example 5: Get All Trips
# ============================================
echo "📝 [Example 5] Getting all trips"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "curl -X GET $API_URL/api/trips \\"
echo "  -H 'Authorization: Bearer $TOKEN'"
echo ""
echo "Response: Array of all trips with calculated values"
echo ""

# ============================================
# Example 6: Speed Conversion Chart
# ============================================
echo "📊 Speed-to-Mileage Conversion Chart"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Speed (km/h) | Mileage (km/l) | Efficiency Loss | Fuel for 400km"
echo "─────────────┼────────────────┼─────────────────┼──────────────"
echo "    ≤60      │     4.0        │      0%         │   100 liters"
echo "    60-70    │     4.0        │      0%         │   100 liters"
echo "    70-80    │     3.6        │     10%         │  111.11 liters"
echo "    80-90    │     3.4        │     15%         │  117.65 liters"
echo "    90-100   │     3.2        │     20%         │  125.00 liters"
echo "   100-110   │     3.0        │     25%         │  133.33 liters"
echo "   110-120   │     2.8        │     30%         │  142.86 liters"
echo "     >120    │     2.6        │     35%         │  153.85 liters"
echo ""

# ============================================
# Example 7: Testing Automatic Recalculation
# ============================================
echo "🔄 [Example 7] Testing Automatic Recalculation"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Scenario: Trip starts at 60 km/h, speed increases to 120 km/h"
echo ""
echo "Step 1: Create trip at 60 km/h, 400 km"
echo "  → fuel_used = 100 liters"
echo ""
echo "Step 2: Update to 70 km/h"
echo "  → fuel_used = 111.11 liters (auto-calculated)"
echo ""
echo "Step 3: Update to 80 km/h"
echo "  → fuel_used = 117.65 liters (auto-calculated)"
echo ""
echo "Step 4: Update to 120 km/h"
echo "  → fuel_used = 153.85 liters (auto-calculated)"
echo ""
echo "✓ All updates trigger automatic recalculation!"
echo ""

# ============================================
# Error Handling Examples
# ============================================
echo "⚠️  [Example 8] Error Handling"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Scenario A: Invalid Trip ID"
echo "  Status: 404 Not Found"
echo "  Response: {\"error\": \"Trip not found or unauthorized\"}"
echo ""
echo "Scenario B: Too Many Updates (Throttle)"
echo "  Status: 429 Too Many Requests"
echo "  Response: {\"error\": \"Too many requests - try again later\"}"
echo ""
echo "Scenario C: Stale Update (old timestamp)"
echo "  Status: 409 Conflict"
echo "  Response: {\"error\": \"Stale update rejected: database has newer data\"}"
echo ""

# ============================================
# Database Trigger Testing
# ============================================
echo "🗄️  [Example 9] Database Trigger Testing"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Run: node backend/tools/test_dynamic_mileage.js"
echo ""
echo "Tests:"
echo "  ✓ Mileage calculation for all speed ranges"
echo "  ✓ Fuel consumption formula"
echo "  ✓ Trip creation with calculations"
echo "  ✓ Trip update with recalculation"
echo "  ✓ Database trigger functionality"
echo ""

# ============================================
# API Integration Testing
# ============================================
echo "🧪 [Example 10] API Integration Testing"
echo "─────────────────────────────────────────────────────────────"
echo ""
echo "Run: node backend/tools/test_api_dynamic_calculations.js"
echo ""
echo "Tests:"
echo "  ✓ Create trip via API"
echo "  ✓ Update trip speed"
echo "  ✓ Update trip distance"
echo "  ✓ Get trip and verify persistence"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "Ready to test! Copy and paste commands in your terminal."
echo "═══════════════════════════════════════════════════════════"
