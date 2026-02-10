from __future__ import annotations

"""
quantum_walk.py — Continuous-Time Quantum Walk (CTQW) engine + code generation.

U(t) = exp(-i A t),  where A is the graph adjacency matrix.

Execution:
    generate_graph()      — Standard topologies (cycle, path, complete, star, grid).
    run_quantum_walk()    — Probability evolution + Qiskit measurement.

Code generation:
    generate_walk_code()  — Class-based code for 5 frameworks.
"""

from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Operator
from qiskit_aer import AerSimulator
from scipy.linalg import expm
import numpy as np
import math


# ═══════════════════════════════════════════════════════════════════════════
#  Graph generators
# ═══════════════════════════════════════════════════════════════════════════


def generate_graph(topology: str, num_vertices: int) -> list[list[float]]:
    """
    Generate an adjacency matrix for a standard graph topology.

    Supported: cycle, path, complete, star, grid.
    """
    n = num_vertices
    A = [[0.0] * n for _ in range(n)]

    if topology == "cycle":
        for i in range(n):
            A[i][(i + 1) % n] = 1.0
            A[(i + 1) % n][i] = 1.0
    elif topology == "path":
        for i in range(n - 1):
            A[i][i + 1] = 1.0
            A[i + 1][i] = 1.0
    elif topology == "complete":
        for i in range(n):
            for j in range(i + 1, n):
                A[i][j] = 1.0
                A[j][i] = 1.0
    elif topology == "star":
        for i in range(1, n):
            A[0][i] = 1.0
            A[i][0] = 1.0
    elif topology == "grid":
        side = int(math.ceil(math.sqrt(n)))
        for i in range(n):
            r, c = divmod(i, side)
            if c + 1 < side and i + 1 < n:
                A[i][i + 1] = 1.0
                A[i + 1][i] = 1.0
            if i + side < n:
                A[i][i + side] = 1.0
                A[i + side][i] = 1.0
    else:
        for i in range(n - 1):
            A[i][i + 1] = 1.0
            A[i + 1][i] = 1.0

    return A


# ═══════════════════════════════════════════════════════════════════════════
#  Execution
# ═══════════════════════════════════════════════════════════════════════════


def run_quantum_walk(
    adjacency_matrix: list[list[float]],
    initial_vertex: int = 0,
    num_steps: int = 10,
    dt: float = 0.5,
    shots: int = 1024,
) -> dict:
    """
    Run a Continuous-Time Quantum Walk (CTQW) on a graph.

    Args:
        adjacency_matrix: Symmetric adjacency matrix of the graph.
        initial_vertex:   Starting vertex (0-indexed).
        num_steps:        Number of time snapshots.
        dt:               Time increment between snapshots.
        shots:            Measurement shots for final step.

    Returns dict with:
        probability_evolution: list of {time, [p0, p1, ...]} snapshots
        final_counts:          measurement counts at the last step
        num_vertices:          number of vertices
        num_qubits:            qubits used (ceil(log2(vertices)))
    """
    A = np.array(adjacency_matrix, dtype=float)
    num_vertices = A.shape[0]

    # Pad to next power of 2 for qubit representation
    num_qubits = max(1, int(math.ceil(math.log2(num_vertices)))) if num_vertices > 1 else 1
    dim = 2 ** num_qubits

    # Extend adjacency to dim × dim (pad with zeros)
    A_padded = np.zeros((dim, dim), dtype=float)
    A_padded[:num_vertices, :num_vertices] = A

    # Initial state: |initial_vertex⟩
    psi0 = np.zeros(dim, dtype=complex)
    psi0[initial_vertex] = 1.0

    probability_evolution: list[dict] = []

    for step in range(num_steps + 1):
        t = step * dt
        U = expm(-1j * A_padded * t)
        psi_t = U @ psi0
        probs = np.abs(psi_t) ** 2

        vertex_probs = probs[:num_vertices].tolist()
        probability_evolution.append({
            "time": round(t, 4),
            "probabilities": vertex_probs,
        })

    # Final step: build Qiskit circuit for measurement
    final_t = num_steps * dt
    U_final = expm(-1j * A_padded * final_t)
    qc = QuantumCircuit(num_qubits)

    if initial_vertex > 0:
        bits = format(initial_vertex, f"0{num_qubits}b")
        for i, b in enumerate(reversed(bits)):
            if b == "1":
                qc.x(i)

    qc.unitary(Operator(U_final), range(num_qubits), label=f"Walk(t={final_t})")
    qc.measure_all()

    sim = AerSimulator()
    compiled = transpile(qc, sim)
    result = sim.run(compiled, shots=shots).result()
    counts = result.get_counts(qc)

    filtered_counts: dict[str, int] = {}
    for state, count in counts.items():
        idx = int(state, 2)
        if idx < num_vertices:
            label = format(idx, f"0{num_qubits}b")
            filtered_counts[label] = filtered_counts.get(label, 0) + count

    most_likely = max(filtered_counts, key=filtered_counts.get) if filtered_counts else "0" * num_qubits

    return {
        "status": "completed",
        "probability_evolution": probability_evolution,
        "final_counts": filtered_counts,
        "most_likely_vertex": int(most_likely, 2),
        "most_likely_state": most_likely,
        "num_vertices": num_vertices,
        "num_qubits": num_qubits,
        "num_steps": num_steps,
        "dt": dt,
        "initial_vertex": initial_vertex,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  Class-based code generation
# ═══════════════════════════════════════════════════════════════════════════


def generate_walk_code(
    adjacency_matrix: list[list[float]],
    initial_vertex: int,
    num_steps: int,
    dt: float,
    framework: str = "qiskit",
) -> str:
    n = len(adjacency_matrix)
    nq = max(1, int(math.ceil(math.log2(n)))) if n > 1 else 1
    t_final = num_steps * dt

    if framework == "qiskit":
        return _walk_qiskit(adjacency_matrix, n, nq, initial_vertex, num_steps, dt, t_final)
    elif framework == "pennylane":
        return _walk_pennylane(adjacency_matrix, n, nq, initial_vertex, num_steps, dt, t_final)
    elif framework == "cirq":
        return _walk_cirq(adjacency_matrix, n, nq, initial_vertex, num_steps, dt, t_final)
    elif framework == "qsharp":
        return _walk_qsharp(n, nq, initial_vertex, t_final)
    elif framework == "qasm":
        return _walk_qasm(nq, initial_vertex, t_final)
    return f"# Unsupported: {framework}"


# ── Qiskit ────────────────────────────────────────────────────────────────


def _walk_qiskit(adj, n, nq, v0, steps, dt, t_final):
    return f'''# Quantum Walk — Qiskit (CTQW)
# {n} vertices, {nq} qubits, start vertex {v0}, t_final={t_final}
import numpy as np
from scipy.linalg import expm
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import Operator
from qiskit_aer import AerSimulator
import math


class QuantumWalk:
    """Continuous-Time Quantum Walk (CTQW) on a graph."""

    def __init__(self, adjacency_matrix, initial_vertex=0, num_steps=10, dt=0.5):
        self.A = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.A.shape[0]
        self.initial_vertex = initial_vertex
        self.num_steps = num_steps
        self.dt = dt
        self.num_qubits = max(1, int(math.ceil(math.log2(self.num_vertices))))
        self.dim = 2 ** self.num_qubits
        # Pad adjacency to dim × dim
        self.A_padded = np.zeros((self.dim, self.dim))
        self.A_padded[:self.num_vertices, :self.num_vertices] = self.A

    def evolve(self, t):
        """Compute U(t)|ψ₀⟩ = exp(-iAt)|v₀⟩."""
        psi0 = np.zeros(self.dim, dtype=complex)
        psi0[self.initial_vertex] = 1.0
        U = expm(-1j * self.A_padded * t)
        return U @ psi0

    def probability_distribution(self, t):
        """Get probabilities at each vertex at time t."""
        psi_t = self.evolve(t)
        probs = np.abs(psi_t[:self.num_vertices]) ** 2
        return probs

    def probability_evolution(self):
        """Track probability over all time steps."""
        evolution = []
        for step in range(self.num_steps + 1):
            t = step * self.dt
            probs = self.probability_distribution(t)
            evolution.append({{"time": round(t, 4), "probs": probs.tolist()}})
        return evolution

    def simulate(self, shots=1024):
        """Build and run Qiskit circuit at final time."""
        t_final = self.num_steps * self.dt
        U_final = expm(-1j * self.A_padded * t_final)
        qc = QuantumCircuit(self.num_qubits)
        # Prepare |v₀⟩
        if self.initial_vertex > 0:
            bits = format(self.initial_vertex, f"0{{self.num_qubits}}b")
            for i, b in enumerate(reversed(bits)):
                if b == "1":
                    qc.x(i)
        qc.unitary(Operator(U_final), range(self.num_qubits),
                    label=f"Walk(t={{t_final}})")
        qc.measure_all()
        sim = AerSimulator()
        result = sim.run(transpile(qc, sim), shots=shots).result()
        return result.get_counts()

    def main(self):
        """Run full walk: evolution + measurement."""
        print(f"CTQW: {{self.num_vertices}} vertices, {{self.num_qubits}} qubits")
        print(f"Start: v{{self.initial_vertex}}, steps={{self.num_steps}}, dt={{self.dt}}\\n")
        for snap in self.probability_evolution():
            probs_str = ", ".join(f"v{{i}}={{p:.4f}}" for i, p in enumerate(snap["probs"]))
            print(f"t={{snap['time']:.2f}}: {{probs_str}}")
        counts = self.simulate()
        print(f"\\nFinal counts: {{counts}}")
        print(f"Most likely: {{max(counts, key=counts.get)}}")


if __name__ == "__main__":
    walk = QuantumWalk(
        adjacency_matrix={adj},
        initial_vertex={v0},
        num_steps={steps},
        dt={dt},
    )
    walk.main()
'''


# ── PennyLane ─────────────────────────────────────────────────────────────


def _walk_pennylane(adj, n, nq, v0, steps, dt, t_final):
    return f'''# Quantum Walk — PennyLane (CTQW)
# {n} vertices, {nq} qubits, start vertex {v0}
import pennylane as qml
import numpy as np
from scipy.linalg import expm
import math


class QuantumWalk:
    """Continuous-Time Quantum Walk (PennyLane)."""

    def __init__(self, adjacency_matrix, initial_vertex=0, num_steps=10, dt=0.5):
        self.A = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.A.shape[0]
        self.initial_vertex = initial_vertex
        self.num_steps = num_steps
        self.dt = dt
        self.num_qubits = max(1, int(math.ceil(math.log2(self.num_vertices))))
        self.dim = 2 ** self.num_qubits
        self.A_padded = np.zeros((self.dim, self.dim))
        self.A_padded[:self.num_vertices, :self.num_vertices] = self.A
        self.dev = qml.device("default.qubit", wires=self.num_qubits)

    def run_circuit(self, t):
        @qml.qnode(self.dev)
        def circuit():
            bits = format(self.initial_vertex, f"0{{self.num_qubits}}b")
            for i, b in enumerate(reversed(bits)):
                if b == "1":
                    qml.PauliX(wires=i)
            U = expm(-1j * self.A_padded * t)
            qml.QubitUnitary(U, wires=range(self.num_qubits))
            return qml.probs(wires=range(self.num_qubits))
        return circuit()

    def probability_evolution(self):
        for step in range(self.num_steps + 1):
            t = step * self.dt
            probs = self.run_circuit(t)
            vertex_probs = probs[:self.num_vertices]
            print(f"t={{t:.2f}}: {{dict(enumerate(np.round(vertex_probs, 4)))}}")


if __name__ == "__main__":
    walk = QuantumWalk(
        adjacency_matrix={adj},
        initial_vertex={v0},
        num_steps={steps},
        dt={dt},
    )
    walk.probability_evolution()
'''


# ── Cirq ──────────────────────────────────────────────────────────────────


def _walk_cirq(adj, n, nq, v0, steps, dt, t_final):
    return f'''# Quantum Walk — Cirq (CTQW)
# {n} vertices, {nq} qubits, start vertex {v0}
import cirq
import numpy as np
from scipy.linalg import expm
import math


class QuantumWalk:
    """Continuous-Time Quantum Walk (Cirq)."""

    def __init__(self, adjacency_matrix, initial_vertex=0, num_steps=10, dt=0.5):
        self.A = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.A.shape[0]
        self.initial_vertex = initial_vertex
        self.num_steps = num_steps
        self.dt = dt
        self.num_qubits = max(1, int(math.ceil(math.log2(self.num_vertices))))
        self.dim = 2 ** self.num_qubits
        self.A_padded = np.zeros((self.dim, self.dim))
        self.A_padded[:self.num_vertices, :self.num_vertices] = self.A
        self.qubits = [cirq.LineQubit(i) for i in range(self.num_qubits)]

    def evolve(self, t):
        psi0 = np.zeros(self.dim, dtype=complex)
        psi0[self.initial_vertex] = 1.0
        U = expm(-1j * self.A_padded * t)
        return U @ psi0

    def probability_evolution(self):
        for step in range(self.num_steps + 1):
            t = step * self.dt
            psi_t = self.evolve(t)
            probs = np.abs(psi_t[:self.num_vertices]) ** 2
            print(f"t={{t:.2f}}: {{dict(enumerate(probs.round(4)))}}")

    def simulate(self, shots=1024):
        t_final = self.num_steps * self.dt
        U_final = expm(-1j * self.A_padded * t_final)
        circuit = cirq.Circuit()
        bits = format(self.initial_vertex, f"0{{self.num_qubits}}b")
        for i, b in enumerate(reversed(bits)):
            if b == "1":
                circuit.append(cirq.X(self.qubits[i]))
        circuit.append(cirq.MatrixGate(U_final).on(*self.qubits))
        circuit.append(cirq.measure(*self.qubits, key="r"))
        return cirq.Simulator().run(circuit, repetitions=shots).histogram(key="r")


if __name__ == "__main__":
    walk = QuantumWalk(
        adjacency_matrix={adj},
        initial_vertex={v0},
        num_steps={steps},
        dt={dt},
    )
    walk.probability_evolution()
    print("\\nFinal counts:", walk.simulate())
'''


# ── Q# ───────────────────────────────────────────────────────────────────


def _walk_qsharp(n, nq, v0, t_final):
    return f'''// Quantum Walk — Q# (CTQW concept)
// {n} vertices, {nq} qubits, start vertex {v0}, t={t_final}
// Note: Q# does not natively support arbitrary unitary matrices.
// You would implement the walk via Hamiltonian simulation (Trotter).
namespace QuantumWalk {{{{
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Measurement;

    @EntryPoint()
    operation Run() : Result[] {{{{
        use q = Qubit[{nq}];
        // Prepare initial vertex |{v0}⟩
        let bits = {list(reversed(format(v0, f'0{nq}b')))};
        for i in 0..{nq-1} {{{{
            if bits[i] == '1' {{{{ X(q[i]); }}}}
        }}}}
        // TODO: Implement Trotter decomposition of exp(-i*A*t)
        mutable results = [];
        for i in 0..{nq-1} {{{{ set results += [M(q[i])]; }}}}
        ResetAll(q);
        return results;
    }}}}
}}}}'''


# ── OpenQASM ──────────────────────────────────────────────────────────────


def _walk_qasm(nq, v0, t_final):
    return f"""// Quantum Walk — OpenQASM 2.0 (CTQW concept)
// {nq} qubits, start vertex {v0}, t={t_final}
// Note: QASM does not support arbitrary unitary gates natively.
// The walk unitary U=exp(-iAt) must be decomposed into native gates.
OPENQASM 2.0;
include "qelib1.inc";
qreg q[{nq}];
creg c[{nq}];

// Prepare initial vertex |{v0}>
""" + "".join(
    f"x q[{i}];\n"
    for i, b in enumerate(reversed(format(v0, f"0{nq}b")))
    if b == "1"
) + f"""
// Apply walk unitary (decomposed)
// ... Trotter decomposition of exp(-i*A*{t_final}) ...

measure q -> c;
"""
