import requests

class TelemetryClient:
    def __init__(self, endpoint_url):
        self.endpoint_url = endpoint_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def send_telemetry(self, payload):
        """Sends the telemetry payload to the backend."""
        try:
            response = self.session.post(self.endpoint_url, json=payload, timeout=5)
            if response.status_code == 200:
                # print(f"Successfully sent telemetry for {payload['deviceId']}")
                return True
            else:
                print(f"Failed to send for {payload['deviceId']}: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"Network error while sending for {payload['deviceId']}: {e}")
            return False
