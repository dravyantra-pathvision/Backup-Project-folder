import datetime
import json

def generate_payload(vehicle_state):
    """
    Generates a telemetry payload matching the structure expected by the backend
    and simulating the ESP32-S3 / Escort TD-BLE / SIM7600G outputs.
    """
    return {
        "deviceId": vehicle_state.device_id,
        "lat": round(vehicle_state.lat, 6),
        "lng": round(vehicle_state.lng, 6),
        "speed": int(round(vehicle_state.speed)),
        "power": vehicle_state.engine_on,
        "fuel": round(vehicle_state.fuel, 2),
        "vibration": round(vehicle_state.vibration, 2),
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

def print_payload(payload):
    """Helper to neatly log what is being sent"""
    print(f"[{payload['timestamp']}] {payload['deviceId']} | "
          f"Power: {'ON' if payload['power'] else 'OFF'} | "
          f"Speed: {payload['speed']} km/h | Fuel: {payload['fuel']} L | "
          f"Lat: {payload['lat']}, Lng: {payload['lng']}")
