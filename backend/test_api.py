"""
test_api.py — Quick smoke tests for the Quantum Circuit Debugger API.

Requires the backend to be running at http://localhost:8000.
Usage:
    python test_api.py
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"


def test_bell_state():
    """Test a basic Bell-state circuit: H(0) → CNOT(0, 1)."""
    payload = {
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CNOT", "qubits": [0, 1]},
        ],
        "num_qubits": 2,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/execute", json=payload)
    print(f"[Bell State]  Status: {resp.status_code}")
    print(json.dumps(resp.json(), indent=2))
    assert resp.status_code == 200, "Bell state test failed!"
    print()


def test_controlled_z():
    """Test a CZ gate on 2 qubits: H(0) → H(1) → CZ(0, 1)."""
    payload = {
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "H", "qubits": [1]},
            {"name": "CZ", "qubits": [0, 1]},
        ],
        "num_qubits": 2,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/execute", json=payload)
    print(f"[CZ Gate]     Status: {resp.status_code}")
    data = resp.json()
    print(f"  Counts: {data.get('counts', {})}")
    assert resp.status_code == 200, "CZ gate test failed!"
    print()


def test_toffoli():
    """Test a Toffoli (CCX) gate: X(0) → X(1) → CCX(0, 1, 2)."""
    payload = {
        "gates": [
            {"name": "X", "qubits": [0]},
            {"name": "X", "qubits": [1]},
            {"name": "CCX", "qubits": [0, 1, 2]},
        ],
        "num_qubits": 3,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/execute", json=payload)
    print(f"[Toffoli]     Status: {resp.status_code}")
    data = resp.json()
    counts = data.get("counts", {})
    print(f"  Counts: {counts}")
    # Both controls |1⟩ → target flips to |1⟩ → expect |111⟩
    assert "111" in counts, f"Expected '111' in counts, got {counts}"
    assert resp.status_code == 200, "Toffoli test failed!"
    print()


def test_swap():
    """Test SWAP gate: X(0) → SWAP(0, 1) — qubit 0 state moves to qubit 1."""
    payload = {
        "gates": [
            {"name": "X", "qubits": [0]},
            {"name": "SWAP", "qubits": [0, 1]},
        ],
        "num_qubits": 2,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/execute", json=payload)
    print(f"[SWAP]        Status: {resp.status_code}")
    data = resp.json()
    counts = data.get("counts", {})
    print(f"  Counts: {counts}")
    # After X(0) → SWAP(0,1): state should be |10⟩
    assert "10" in counts, f"Expected '10' in counts, got {counts}"
    print()


def test_controlled_rotations():
    """Test controlled rotation gates: H(0) → CRX(π, 0, 1)."""
    payload = {
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CRX", "qubits": [0, 1], "params": [3.14159]},
        ],
        "num_qubits": 2,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/execute", json=payload)
    print(f"[CRX Gate]    Status: {resp.status_code}")
    data = resp.json()
    print(f"  Counts: {data.get('counts', {})}")
    assert resp.status_code == 200, "CRX test failed!"
    print()


def test_qft():
    """Test the QFT endpoint on 3 qubits with initial state |101⟩."""
    payload = {
        "num_qubits": 3,
        "initial_state": "101",
        "inverse": False,
        "shots": 1000,
    }
    resp = requests.post(f"{BASE_URL}/qft", json=payload)
    print(f"[QFT]         Status: {resp.status_code}")
    data = resp.json()
    print(f"  Status:  {data.get('status')}")
    print(f"  Depth:   {data.get('circuit_depth')}")
    print(f"  Gates:   {data.get('num_gates')}")
    print(f"  Counts:  {data.get('counts', {})}")
    assert resp.status_code == 200, "QFT test failed!"
    print()


def test_optimize():
    """Test the optimisation endpoint with a simple circuit."""
    payload = {
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "H", "qubits": [0]},  # Two consecutive H = Identity
            {"name": "X", "qubits": [1]},
        ],
        "num_qubits": 2,
    }
    resp = requests.post(f"{BASE_URL}/optimize", json=payload)
    print(f"[Optimize]    Status: {resp.status_code}")
    data = resp.json()
    print(f"  {data.get('improvement_msg', '')}")
    assert resp.status_code == 200, "Optimize test failed!"
    print()


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("  Quantum Circuit Debugger — API Smoke Tests")
    print("=" * 60)
    print()

    tests = [
        test_bell_state,
        test_controlled_z,
        test_toffoli,
        test_swap,
        test_controlled_rotations,
        test_qft,
        test_optimize,
    ]

    passed = 0
    failed = 0

    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except Exception as e:
            print(f"  ✗ {test_fn.__name__} FAILED: {e}")
            failed += 1

    print("=" * 60)
    print(f"  Results: {passed} passed, {failed} failed")
    print("=" * 60)

    sys.exit(1 if failed else 0)
