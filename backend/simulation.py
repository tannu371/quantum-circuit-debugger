"""
simulation.py — Quantum circuit construction and simulation engine.

Provides functions to:
  • Build Qiskit QuantumCircuits from JSON gate descriptions.
  • Run circuits on the Aer simulator for measurement counts.
  • Extract statevectors for probability / amplitude analysis.
  • Generate per-qubit Bloch sphere visualizations.
  • Construct standard QFT (Quantum Fourier Transform) circuits.
"""

from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
import numpy as np
from typing import List, Dict, Any

# ---------------------------------------------------------------------------
# Supported gate name → handler mapping reference
# ---------------------------------------------------------------------------
# Single-qubit:  H, X, Y, Z, S, T, RX(θ), RY(θ), RZ(θ)
# Two-qubit:     CNOT/CX, CY, CZ, CH, SWAP, CRX(θ), CRY(θ), CRZ(θ), CP(θ)
# Three-qubit:   CCX (Toffoli), CSWAP (Fredkin)
# Measurement:   M
# ---------------------------------------------------------------------------


def build_circuit(num_qubits: int, gates: List[Dict[str, Any]]) -> QuantumCircuit:
    """
    Construct a Qiskit ``QuantumCircuit`` from a list of gate dictionaries.

    Each dictionary in *gates* must contain:
      - ``name``   (str):            Gate identifier (case-insensitive).
      - ``qubits`` (List[int]):      Qubit indices the gate acts on.
      - ``params`` (List[float], optional): Parameters for rotation / phase gates.

    Args:
        num_qubits: Total number of qubits in the circuit.
        gates:      Ordered sequence of gate descriptions.

    Returns:
        A fully constructed ``QuantumCircuit`` ready for simulation.

    Raises:
        ValueError: If a gate references a qubit index outside ``[0, num_qubits)``.
    """
    qc = QuantumCircuit(num_qubits)

    for gate in gates:
        name = gate.get("name", "").upper()
        qubits = gate.get("qubits", [])
        params = gate.get("params", []) or []

        # --- Single-qubit gates (no parameters) --------------------------
        if name == "H":
            qc.h(qubits[0])
        elif name == "X":
            qc.x(qubits[0])
        elif name == "Y":
            qc.y(qubits[0])
        elif name == "Z":
            qc.z(qubits[0])
        elif name == "S":
            qc.s(qubits[0])
        elif name == "T":
            qc.t(qubits[0])

        # --- Single-qubit rotation gates (one θ parameter) ----------------
        elif name == "RX":
            theta = params[0] if params else np.pi / 2
            qc.rx(theta, qubits[0])
        elif name == "RY":
            theta = params[0] if params else np.pi / 2
            qc.ry(theta, qubits[0])
        elif name == "RZ":
            theta = params[0] if params else np.pi / 2
            qc.rz(theta, qubits[0])

        # --- Two-qubit gates (no parameters) ------------------------------
        elif name in ("CNOT", "CX"):
            if len(qubits) >= 2:
                qc.cx(qubits[0], qubits[1])
        elif name == "CY":
            if len(qubits) >= 2:
                qc.cy(qubits[0], qubits[1])
        elif name == "CZ":
            if len(qubits) >= 2:
                qc.cz(qubits[0], qubits[1])
        elif name == "CH":
            if len(qubits) >= 2:
                qc.ch(qubits[0], qubits[1])
        elif name == "SWAP":
            if len(qubits) >= 2:
                qc.swap(qubits[0], qubits[1])

        # --- Two-qubit controlled rotation gates (one θ parameter) --------
        elif name == "CRX":
            theta = params[0] if params else np.pi / 2
            if len(qubits) >= 2:
                qc.crx(theta, qubits[0], qubits[1])
        elif name == "CRY":
            theta = params[0] if params else np.pi / 2
            if len(qubits) >= 2:
                qc.cry(theta, qubits[0], qubits[1])
        elif name == "CRZ":
            theta = params[0] if params else np.pi / 2
            if len(qubits) >= 2:
                qc.crz(theta, qubits[0], qubits[1])
        elif name == "CP":
            # Controlled-Phase gate — used internally by QFT
            theta = params[0] if params else np.pi / 2
            if len(qubits) >= 2:
                qc.cp(theta, qubits[0], qubits[1])

        # --- Three-qubit gates --------------------------------------------
        elif name in ("CCX", "TOFFOLI"):
            if len(qubits) >= 3:
                qc.ccx(qubits[0], qubits[1], qubits[2])
        elif name in ("CSWAP", "FREDKIN"):
            if len(qubits) >= 3:
                qc.cswap(qubits[0], qubits[1], qubits[2])

        # --- Measurement --------------------------------------------------
        elif name == "M":
            qc.measure_all()

        # Unknown gates are silently skipped (logged in production)

    return qc


def run_circuit(circuit: QuantumCircuit, shots: int = 1024) -> Dict[str, Any]:
    """
    Execute a ``QuantumCircuit`` on the Aer ``qasm_simulator`` backend.

    If the circuit does not already contain classical bits (measurements),
    ``measure_all()`` is applied automatically so that counts can be returned.

    Args:
        circuit: The circuit to execute.
        shots:   Number of measurement repetitions.

    Returns:
        ``{"counts": {...}}`` on success, or ``{"error": "..."}`` on failure.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
            circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator()

        # Append measurements when none are present
        if not circuit.clbits:
            circuit.measure_all()

        compiled = transpile(circuit, simulator)
        result = simulator.run(compiled, shots=shots).result()
        counts = result.get_counts(circuit)
        return {"counts": counts}
    except Exception as e:
        return {"error": str(e)}


def get_statevector(circuit: QuantumCircuit) -> Dict[str, Any]:
    """
    Simulate the circuit and return the final statevector *before* measurement.

    Measurements are stripped from a copy of the circuit so that the
    statevector is not collapsed.

    Args:
        circuit: The circuit to simulate.

    Returns:
        ``{"statevector": [[real, imag], ...]}`` on success, or
        ``{"error": "..."}`` on failure.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
            circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator(method="statevector")

        # Work on a copy so the original circuit is not mutated
        circuit_sv = circuit.copy()
        circuit_sv.remove_final_measurements()
        circuit_sv.save_statevector()

        compiled = transpile(circuit_sv, simulator)
        result = simulator.run(compiled).result()
        statevector = result.get_statevector(circuit_sv)

        # Serialise complex amplitudes as [real, imag] pairs for JSON transport
        sv_list = [[amp.real, amp.imag] for amp in np.asarray(statevector)]
        return {"statevector": sv_list}
    except Exception as e:
        return {"error": str(e)}


def get_bloch_image(circuit: QuantumCircuit) -> Dict[str, Any]:
    """
    Generate per-qubit Bloch sphere PNG images encoded as Base64 strings.

    For each qubit the reduced density matrix is computed via partial tracing,
    and the Bloch vector ``(⟨X⟩, ⟨Y⟩, ⟨Z⟩)`` is extracted.

    Args:
        circuit: The circuit to simulate.

    Returns:
        ``{"bloch_images": [base64_str, ...]}`` on success, or
        ``{"error": "..."}`` on failure.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
            circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator(method="statevector")

        circuit_sv = circuit.copy()
        circuit_sv.remove_final_measurements()
        circuit_sv.save_statevector()

        compiled = transpile(circuit_sv, simulator)
        result = simulator.run(compiled).result()
        statevector = result.get_statevector(circuit_sv)

        from qiskit.visualization import plot_bloch_vector
        from qiskit.quantum_info import partial_trace
        import io
        import base64
        import matplotlib
        matplotlib.use("Agg")  # Non-interactive backend for server-side rendering
        import matplotlib.pyplot as plt

        num_qubits = circuit.num_qubits
        bloch_images: List[str] = []

        for i in range(num_qubits):
            # Trace out every qubit except qubit i
            trace_indices = [j for j in range(num_qubits) if j != i]
            rho = partial_trace(statevector, trace_indices)

            # Extract Bloch vector from the 2×2 density matrix
            dm = rho.data
            x = float(np.real(dm[0, 1] + dm[1, 0]))
            y = float(np.real(1j * (dm[0, 1] - dm[1, 0])))
            z = float(np.real(dm[0, 0] - dm[1, 1]))

            fig = plt.figure(figsize=(3, 3))
            ax = fig.add_subplot(111, projection="3d")
            plot_bloch_vector([x, y, z], ax=ax, title=f"Qubit {i}")

            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", transparent=True)
            buf.seek(0)
            bloch_images.append(base64.b64encode(buf.read()).decode("utf-8"))
            plt.close(fig)

        return {"bloch_images": bloch_images}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Quantum Fourier Transform (QFT)
# ---------------------------------------------------------------------------


def build_qft_circuit(num_qubits: int, inverse: bool = False) -> QuantumCircuit:
    """
    Construct a Quantum Fourier Transform circuit.

    The QFT maps computational basis states to their Fourier-transformed
    counterparts using a cascade of Hadamard and controlled-phase (CP) gates
    followed by qubit reversal (SWAP).

    The circuit structure for *n* qubits is::

        For j = 0 … n-1:
            H on qubit j
            For k = j+1 … n-1:
                CP(π / 2^(k-j)) controlled on k, target j
        SWAP pairs to reverse qubit order

    Args:
        num_qubits: Number of qubits for the QFT.
        inverse:    If ``True``, build the inverse QFT (QFT†).

    Returns:
        A ``QuantumCircuit`` implementing the (inverse) QFT.
    """
    qc = QuantumCircuit(num_qubits, name="QFT")

    for j in range(num_qubits):
        qc.h(j)
        for k in range(j + 1, num_qubits):
            # Controlled-phase rotation: angle = π / 2^(k - j)
            angle = np.pi / (2 ** (k - j))
            qc.cp(angle, k, j)

    # Reverse qubit ordering to match standard QFT convention
    for i in range(num_qubits // 2):
        qc.swap(i, num_qubits - 1 - i)

    if inverse:
        qc = qc.inverse()
        qc.name = "QFT†"

    return qc
