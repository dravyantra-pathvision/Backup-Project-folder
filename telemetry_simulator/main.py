import yaml
import time
import asyncio
from models import VehicleState
from telemetry import generate_payload, print_payload
from services import TelemetryClient

async def simulate_vehicle(vehicle_state, client, update_interval):
    """
    Simulates a single vehicle's lifecycle asynchronously.
    """
    while True:
        # 1. Update internal physics/state
        vehicle_state.update(update_interval)

        # 2. Generate JSON payload
        payload = generate_payload(vehicle_state)

        # 3. Print for local monitoring
        print_payload(payload)

        # 4. Send to backend
        # Using a thread pool or run_in_executor for the synchronous requests call 
        # is better for true async, but since we have only 3 vehicles, synchronous is fine for MVP.
        client.send_telemetry(payload)

        # Wait for the next tick
        await asyncio.sleep(update_interval)

async def main():
    print("Initializing Enterprise-Grade Hardware Telemetry Simulator...")
    
    # Load configuration
    try:
        with open("config.yaml", "r") as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error loading config.yaml: {e}")
        return

    sim_config = config.get("simulation", {})
    update_interval = sim_config.get("update_interval_seconds", 5)
    api_endpoint = sim_config.get("api_endpoint", "http://localhost:3000/api/telemetry")
    
    vehicles_config = config.get("vehicles", [])
    if not vehicles_config:
        print("No vehicles found in configuration.")
        return

    client = TelemetryClient(api_endpoint)
    tasks = []

    print(f"Starting simulation for {len(vehicles_config)} vehicles. Sending updates every {update_interval}s to {api_endpoint}\n")

    for v_conf in vehicles_config:
        state = VehicleState(v_conf)
        task = asyncio.create_task(simulate_vehicle(state, client, update_interval))
        tasks.append(task)

    # Run indefinitely
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        print("Simulation stopped.")
    except KeyboardInterrupt:
        print("Simulation interrupted by user.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSimulator exited successfully.")
