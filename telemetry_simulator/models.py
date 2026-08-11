import math
from geopy.distance import distance as geopy_distance

class VehicleState:
    def __init__(self, config):
        self.device_id = config['device_id']
        self.plate = config['plate']
        self.lat = config['start_lat']
        self.lng = config['start_lng']
        self.fuel_capacity = config['fuel_capacity']
        self.fuel = config['initial_fuel']
        self.behavior = config.get('behavior', 'normal')
        self.route = config.get('route_waypoints', [])
        
        self.current_waypoint_idx = 0
        self.speed = 0.0
        self.engine_on = False
        self.vibration = 0.0
        self.ignition_status = 0
        
        # Behavior params
        if self.behavior == 'aggressive':
            self.max_speed = 80.0
            self.acceleration = 10.0
            self.fuel_consumption_rate = 0.05 # L/sec
            self.idle_probability = 0.05
        elif self.behavior == 'idle_heavy':
            self.max_speed = 40.0
            self.acceleration = 3.0
            self.fuel_consumption_rate = 0.02
            self.idle_probability = 0.4
        else: # normal
            self.max_speed = 60.0
            self.acceleration = 5.0
            self.fuel_consumption_rate = 0.03
            self.idle_probability = 0.1

    def update(self, dt_seconds):
        """Update the vehicle's state based on its route and behavior."""
        import random
        
        if not self.route:
            return

        # Engine on/off logic
        if not self.engine_on and self.fuel > 0:
            if random.random() > 0.1:
                self.engine_on = True
                self.ignition_status = 1
        elif self.fuel <= 0:
            self.engine_on = False
            self.ignition_status = 0
            self.speed = 0.0

        if not self.engine_on:
            self.vibration = 0.0
            return

        # Idle logic
        if random.random() < self.idle_probability:
            self.speed = max(0.0, self.speed - self.acceleration * dt_seconds)
            self.vibration = 1.0 + random.random()
        else:
            self.speed = min(self.max_speed, self.speed + self.acceleration * dt_seconds)
            self.vibration = 3.0 + random.random() * 2

        # Fuel logic
        if self.engine_on:
            # Idle consumes less fuel
            multiplier = 0.2 if self.speed == 0 else 1.0
            self.fuel -= self.fuel_consumption_rate * multiplier * dt_seconds
            if self.fuel <= 0:
                self.fuel = self.fuel_capacity # Auto-refill when empty

        # Movement logic
        if self.speed > 0:
            target = self.route[(self.current_waypoint_idx + 1) % len(self.route)]
            target_lat, target_lng = target[0], target[1]
            
            # Calculate distance to target
            dist_km = geopy_distance((self.lat, self.lng), (target_lat, target_lng)).km
            if dist_km == 0:
                dist_km = 0.000001 # Prevent division by zero
            
            # Distance moved in dt_seconds
            dist_moved_km = (self.speed / 3600.0) * dt_seconds
            
            if dist_moved_km >= dist_km:
                # Reached waypoint
                self.lat, self.lng = target_lat, target_lng
                self.current_waypoint_idx = (self.current_waypoint_idx + 1) % len(self.route)
            else:
                # Move towards target using simple interpolation
                ratio = dist_moved_km / dist_km
                self.lat = self.lat + (target_lat - self.lat) * ratio
                self.lng = self.lng + (target_lng - self.lng) * ratio
