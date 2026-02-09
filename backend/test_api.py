import requests
import json

url = "http://localhost:8000/execute"

# Bell State Circuit: H(0), CNOT(0, 1)
payload = {
    "gates": [
        {"name": "H", "qubits": [0]},
        {"name": "CNOT", "qubits": [0, 1]}
    ],
    "num_qubits": 2,
    "shots": 1000
}

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
