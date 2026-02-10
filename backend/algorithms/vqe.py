from __future__ import annotations

"""
vqe.py — VQE engine + class-based code generation.

Execution:
    build_vqe_ansatz()    — RY + CX entangling ansatz.
    run_vqe()             — Full optimisation + measurement.
    build_ansatz()        — Legacy circuit-data ansatz (backward compat).
    run_optimization()    — Legacy VQE runner.
    maxcut_hamiltonian_from_adjacency() — Adjacency → ZZ Hamiltonian.

Code generation:
    generate_vqe_code()   — Modular, class-based code for 5 frameworks.
    generate_maxcut_code() — QuantumMaxCutClustering class-based code.
"""

from qiskit import QuantumCircuit, transpile
from qiskit.circuit import Parameter
from qiskit_aer.primitives import Estimator
from qiskit_aer import AerSimulator
from scipy.optimize import minimize
import numpy as np

from algorithms.hamiltonian import parse_hamiltonian, bases_scales_to_hamiltonian


# ═══════════════════════════════════════════════════════════════════════════
#  Ansatz builder
# ═══════════════════════════════════════════════════════════════════════════


def build_vqe_ansatz(num_qubits: int, depth: int = 1) -> tuple[QuantumCircuit, list[Parameter]]:
    """RY + CX entangling ansatz."""
    qc = QuantumCircuit(num_qubits)
    params: list[Parameter] = []
    for layer in range(depth):
        for q in range(num_qubits):
            p = Parameter(f"θ_{layer}_{q}")
            params.append(p)
            qc.ry(p, q)
        for q in range(num_qubits - 1):
            qc.cx(q, q + 1)
    return qc, params


# ═══════════════════════════════════════════════════════════════════════════
#  Adjacency → MaxCut Hamiltonian
# ═══════════════════════════════════════════════════════════════════════════


def maxcut_hamiltonian_from_adjacency(
    adjacency_matrix: list[list[float]],
    invert: bool = True,
) -> tuple[list[str], list[float]]:
    """
    Convert an adjacency matrix to MaxCut Hamiltonian bases/scales.

    Follows the book's QuantumMaxCutClustering pattern:
    - If ``invert`` is True, use distance matrix ``1 − A`` (non-edges become edges).
    - For every pair (i, j) with nonzero weight w_ij, create basis ``I...Z_i...Z_j...I``
      with coefficient w_ij.

    Returns (bases, scales) ready for VQE.
    """
    import numpy as np
    A = np.array(adjacency_matrix, dtype=float)
    n = A.shape[0]

    if invert:
        H = 1 - A
        np.fill_diagonal(H, 0)  # no self-loops
    else:
        H = A.copy()
        np.fill_diagonal(H, 0)

    template = "I" * n
    bases: list[str] = []
    scales: list[float] = []

    for i in range(n):
        for j in range(i + 1, n):
            if H[i, j] > 0:
                base = list(template)
                base[i] = "Z"
                base[j] = "Z"
                bases.append("".join(base))
                scales.append(float(H[i, j]))

    return bases, scales


# ═══════════════════════════════════════════════════════════════════════════
#  Execution
# ═══════════════════════════════════════════════════════════════════════════


def run_vqe(
    num_qubits: int,
    hamiltonian_bases: list[str],
    hamiltonian_scales: list[float],
    ansatz_depth: int = 1,
    max_iter: int = 100,
    method: str = "COBYLA",
    shots: int = 1024,
) -> dict:
    """Run full VQE: build Hamiltonian from bases+scales, RY ansatz, minimise."""
    operator = bases_scales_to_hamiltonian(hamiltonian_bases, hamiltonian_scales)
    ansatz, parameters = build_vqe_ansatz(num_qubits, depth=ansatz_depth)
    estimator = Estimator()
    history: list[float] = []

    def cost_func(params_values):
        job = estimator.run([ansatz], [operator], [params_values])
        energy = float(job.result().values[0])
        history.append(energy)
        return energy

    x0 = np.random.uniform(0, 2 * np.pi, size=len(parameters))
    result = minimize(cost_func, x0, method=method, options={"maxiter": max_iter})
    opt_params = result.x.tolist()

    bound_qc = ansatz.assign_parameters(dict(zip(parameters, result.x)))

    # Statevector
    sim_sv = AerSimulator(method="statevector")
    sv_qc = bound_qc.copy()
    sv_qc.save_statevector()
    sv_compiled = transpile(sv_qc, sim_sv)
    sv_result = sim_sv.run(sv_compiled).result()
    statevector = sv_result.get_statevector(sv_qc)
    probs = [float(abs(a) ** 2) for a in np.asarray(statevector)]

    # Counts
    meas_qc = bound_qc.copy()
    meas_qc.measure_all()
    sim_qasm = AerSimulator()
    meas_compiled = transpile(meas_qc, sim_qasm)
    meas_result = sim_qasm.run(meas_compiled, shots=shots).result()
    counts = meas_result.get_counts(meas_qc)
    most_likely = max(counts, key=counts.get)

    return {
        "status": "completed",
        "optimal_energy": float(result.fun),
        "optimal_params": opt_params,
        "history": history,
        "message": result.message if hasattr(result, "message") else "Optimization complete.",
        "counts": counts,
        "probabilities": probs,
        "most_likely_state": most_likely,
        "num_qubits": num_qubits,
        "ansatz_depth": ansatz_depth,
        "hamiltonian_bases": hamiltonian_bases,
        "hamiltonian_scales": hamiltonian_scales,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  Legacy VQE (circuit-based ansatz, backward compat)
# ═══════════════════════════════════════════════════════════════════════════


def build_ansatz(circuit_data, num_qubits: int):
    qc = QuantumCircuit(num_qubits)
    params: list[Parameter] = []
    for i, gate in enumerate(circuit_data.gates):
        name = gate.name.upper()
        qubits = gate.qubits
        if name == "H": qc.h(qubits[0])
        elif name == "X": qc.x(qubits[0])
        elif name == "Y": qc.y(qubits[0])
        elif name == "Z": qc.z(qubits[0])
        elif name == "S": qc.s(qubits[0])
        elif name == "T": qc.t(qubits[0])
        elif name in ("RX", "RY", "RZ"):
            p = Parameter(f"theta_{i}")
            params.append(p)
            getattr(qc, name.lower())(p, qubits[0])
        elif name in ("CNOT", "CX") and len(qubits) >= 2: qc.cx(qubits[0], qubits[1])
        elif name == "CY" and len(qubits) >= 2: qc.cy(qubits[0], qubits[1])
        elif name == "CZ" and len(qubits) >= 2: qc.cz(qubits[0], qubits[1])
        elif name == "CH" and len(qubits) >= 2: qc.ch(qubits[0], qubits[1])
        elif name == "SWAP" and len(qubits) >= 2: qc.swap(qubits[0], qubits[1])
        elif name in ("CRX", "CRY", "CRZ") and len(qubits) >= 2:
            p = Parameter(f"theta_{i}")
            params.append(p)
            getattr(qc, name.lower())(p, qubits[0], qubits[1])
        elif name in ("CCX", "TOFFOLI") and len(qubits) >= 3: qc.ccx(qubits[0], qubits[1], qubits[2])
        elif name in ("CSWAP", "FREDKIN") and len(qubits) >= 3: qc.cswap(qubits[0], qubits[1], qubits[2])
    return qc, params


def run_optimization(circuit_data, hamiltonian_str, max_iter=50, method="COBYLA"):
    num_qubits = circuit_data.num_qubits
    operator = parse_hamiltonian(hamiltonian_str, num_qubits)
    ansatz, parameters = build_ansatz(circuit_data, num_qubits)
    estimator = Estimator()
    history: list[float] = []

    def cost_func(params_values):
        job = estimator.run([ansatz], [operator], [params_values])
        energy = job.result().values[0]
        history.append(float(energy))
        return energy

    if parameters:
        x0 = np.random.uniform(0, 2 * np.pi, size=len(parameters))
        result = minimize(cost_func, x0, method=method, options={"maxiter": max_iter})
        return {
            "status": "completed", "optimal_energy": result.fun,
            "optimal_params": result.x.tolist(), "history": history,
            "message": result.message,
        }
    else:
        energy = cost_func([])
        return {
            "status": "completed", "optimal_energy": energy,
            "optimal_params": [], "history": [energy],
            "message": "No parameters to optimize.",
        }


# ═══════════════════════════════════════════════════════════════════════════
#  Class-based code generation
# ═══════════════════════════════════════════════════════════════════════════


def generate_vqe_code(
    num_qubits: int, hamiltonian_bases: list[str],
    hamiltonian_scales: list[float], opt_params: list[float],
    ansatz_depth: int = 1, framework: str = "qiskit",
) -> str:
    if framework == "qiskit":
        return _vqe_qiskit(num_qubits, hamiltonian_bases, hamiltonian_scales, opt_params, ansatz_depth)
    elif framework == "pennylane":
        return _vqe_pennylane(num_qubits, hamiltonian_bases, hamiltonian_scales, opt_params, ansatz_depth)
    elif framework == "cirq":
        return _vqe_cirq(num_qubits, hamiltonian_bases, hamiltonian_scales, opt_params, ansatz_depth)
    elif framework == "qsharp":
        return _vqe_qsharp(num_qubits, opt_params, ansatz_depth)
    elif framework == "qasm":
        return _vqe_qasm(num_qubits, opt_params, ansatz_depth)
    return f"# Unsupported framework: {framework}"


# ── Qiskit ────────────────────────────────────────────────────────────────


def _vqe_qiskit(n, bases, scales, params, depth):
    return f'''# VQE — Qiskit  |  {n} qubits, depth {depth}
import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer import AerSimulator
from qiskit_aer.primitives import Estimator
from qiskit.circuit import Parameter
from scipy.optimize import minimize


class VQE:
    """Variational Quantum Eigensolver (Qiskit)."""

    def __init__(self, num_qubits, hamiltonian_bases, hamiltonian_scales,
                 ansatz_depth=1):
        self.num_qubits = num_qubits
        self.ansatz_depth = ansatz_depth
        self.hamiltonian = SparsePauliOp(hamiltonian_bases, hamiltonian_scales)
        self.ansatz, self.params = self._build_ansatz()
        self.history = []

    def _build_ansatz(self):
        """RY + CX entangling ansatz."""
        qc = QuantumCircuit(self.num_qubits)
        params = []
        for layer in range(self.ansatz_depth):
            for q in range(self.num_qubits):
                p = Parameter(f"t_{{layer}}_{{q}}")
                params.append(p)
                qc.ry(p, q)
            for q in range(self.num_qubits - 1):
                qc.cx(q, q + 1)
        return qc, params

    def cost_function(self, param_values):
        """Evaluate <H> for given parameters."""
        estimator = Estimator()
        job = estimator.run([self.ansatz], [self.hamiltonian], [param_values])
        energy = float(job.result().values[0])
        self.history.append(energy)
        return energy

    def optimize(self, max_iter=100, method="COBYLA"):
        """Run classical optimizer."""
        x0 = np.random.uniform(0, 2 * np.pi, size=len(self.params))
        result = minimize(self.cost_function, x0, method=method,
                          options={{"maxiter": max_iter}})
        return result.x.tolist(), float(result.fun)

    def simulate(self, opt_params, shots=1024):
        """Simulate with optimal parameters and return counts."""
        bound = self.ansatz.assign_parameters(
            dict(zip(self.params, opt_params)))
        bound.measure_all()
        sim = AerSimulator()
        result = sim.run(transpile(bound, sim), shots=shots).result()
        return result.get_counts()


if __name__ == "__main__":
    vqe = VQE(
        num_qubits={n},
        hamiltonian_bases={bases},
        hamiltonian_scales={scales},
        ansatz_depth={depth},
    )

    # Pre-computed optimal parameters
    optimal_params = {params}
    counts = vqe.simulate(optimal_params, shots=1024)
    energy = vqe.cost_function(optimal_params)
    print("Energy:", energy)
    print("Counts:", counts)
    print("Most likely:", max(counts, key=counts.get))
'''


# ── PennyLane ─────────────────────────────────────────────────────────────


def _vqe_pennylane(n, bases, scales, params, depth):
    obs_lines = []
    for base, scale in zip(bases, scales):
        terms = []
        for i, c in enumerate(base):
            if c == "Z": terms.append(f"qml.PauliZ({i})")
            elif c == "X": terms.append(f"qml.PauliX({i})")
            elif c == "Y": terms.append(f"qml.PauliY({i})")
            else: terms.append(f"qml.Identity({i})")
        obs_lines.append(f"    ({scale}, {' @ '.join(terms)}),")
    return f'''# VQE — PennyLane  |  {n} qubits, depth {depth}
import pennylane as qml
import numpy as np
from scipy.optimize import minimize


class VQE:
    """Variational Quantum Eigensolver (PennyLane)."""

    def __init__(self, num_qubits, ansatz_depth=1):
        self.num_qubits = num_qubits
        self.ansatz_depth = ansatz_depth
        self.dev = qml.device("default.qubit", wires=num_qubits)
        self.history = []
        coeffs_obs = [
{chr(10).join(obs_lines)}
        ]
        self.H = qml.Hamiltonian(
            [c for c, _ in coeffs_obs],
            [o for _, o in coeffs_obs],
        )

    def circuit(self, params):
        @qml.qnode(self.dev)
        def _circuit(p):
            idx = 0
            for layer in range(self.ansatz_depth):
                for q in range(self.num_qubits):
                    qml.RY(p[idx], wires=q); idx += 1
                for q in range(self.num_qubits - 1):
                    qml.CNOT(wires=[q, q + 1])
            return qml.expval(self.H)
        return _circuit(params)

    def optimize(self, max_iter=100):
        n_params = self.num_qubits * self.ansatz_depth

        def cost_fn(p):
            val = float(self.circuit(p))
            self.history.append(val)
            return val

        x0 = np.random.uniform(0, 2 * np.pi, size=n_params)
        result = minimize(cost_fn, x0, method="COBYLA",
                          options={{"maxiter": max_iter}})
        return result.x.tolist(), float(result.fun)


if __name__ == "__main__":
    vqe = VQE(num_qubits={n}, ansatz_depth={depth})
    optimal = np.array({params})
    print("Energy:", vqe.circuit(optimal))
'''


# ── Cirq ──────────────────────────────────────────────────────────────────


def _vqe_cirq(n, bases, scales, params, depth):
    return f'''# VQE — Cirq  |  {n} qubits, depth {depth}
import cirq
import numpy as np
from scipy.optimize import minimize


class VQE:
    """Variational Quantum Eigensolver (Cirq)."""

    def __init__(self, num_qubits, hamiltonian_bases, hamiltonian_scales,
                 ansatz_depth=1):
        self.num_qubits = num_qubits
        self.bases = hamiltonian_bases
        self.scales = hamiltonian_scales
        self.ansatz_depth = ansatz_depth
        self.qubits = [cirq.LineQubit(i) for i in range(num_qubits)]
        self.history = []

    def build_ansatz(self, theta):
        c = cirq.Circuit()
        idx = 0
        for layer in range(self.ansatz_depth):
            for q in range(self.num_qubits):
                c.append(cirq.ry(theta[idx] * np.pi)(self.qubits[q]))
                idx += 1
            for q in range(self.num_qubits - 1):
                c.append(cirq.CNOT(self.qubits[q], self.qubits[q + 1]))
        c.append(cirq.measure(*self.qubits, key="m"))
        return c

    def expectation(self, theta, copies=10000):
        c = self.build_ansatz(theta)
        hist = dict(cirq.Simulator().run(c, repetitions=copies).histogram(key="m"))
        exp = 0
        for base, scale in zip(self.bases, self.scales):
            for state, count in hist.items():
                ev = 1
                bits = format(state, f"0{{self.num_qubits}}b")
                for i, ch in enumerate(base):
                    if ch == "Z":
                        ev *= 1 if bits[i] == "0" else -1
                exp += scale * ev * count
        return exp / copies

    def optimize(self, max_iter=100):
        n_params = self.num_qubits * self.ansatz_depth

        def cost_fn(p):
            val = self.expectation(p)
            self.history.append(val)
            return val

        x0 = np.random.uniform(0, 2 * np.pi, size=n_params)
        result = minimize(cost_fn, x0, method="COBYLA",
                          options={{"maxiter": max_iter}})
        return result.x.tolist(), result.fun


if __name__ == "__main__":
    vqe = VQE(
        num_qubits={n},
        hamiltonian_bases={bases},
        hamiltonian_scales={scales},
        ansatz_depth={depth},
    )
    optimal = {params}
    print("Energy:", vqe.expectation(optimal))
'''


# ── Q# ───────────────────────────────────────────────────────────────────


def _vqe_qsharp(n, params, depth):
    return f"""// VQE Ansatz — Q#  |  {n} qubits, depth {depth}
namespace VQE {{{{
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Measurement;
    @EntryPoint()
    operation Run() : Result[] {{{{
        use q = Qubit[{n}];
        let theta = {params};
        mutable idx = 0;
        for layer in 0..{depth-1} {{{{
            for i in 0..{n-1} {{{{ Ry(theta[idx], q[i]); set idx += 1; }}}}
            for i in 0..{n-2} {{{{ CNOT(q[i], q[i+1]); }}}}
        }}}}
        mutable r = [];
        for i in 0..{n-1} {{{{ set r += [M(q[i])]; }}}}
        ResetAll(q);
        return r;
    }}}}
}}}}"""


# ── OpenQASM ──────────────────────────────────────────────────────────────


def _vqe_qasm(n, params, depth):
    code = f"// VQE Ansatz — QASM 2.0  |  {n} qubits, depth {depth}\nOPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[{n}];\ncreg c[{n}];\n\n"
    idx = 0
    for layer in range(depth):
        for q in range(n):
            angle = params[idx] if idx < len(params) else 0
            code += f"ry({angle}) q[{q}];\n"; idx += 1
        for q in range(n - 1):
            code += f"cx q[{q}], q[{q+1}];\n"
        code += "\n"
    code += "measure q -> c;\n"
    return code


# ═══════════════════════════════════════════════════════════════════════════
#  MaxCut Clustering — class-based code generation
# ═══════════════════════════════════════════════════════════════════════════


def generate_maxcut_code(
    adjacency_matrix: list[list[float]],
    opt_params: list[float],
    invert_adjacency: bool = True,
    framework: str = "qiskit",
) -> str:
    """Generate QuantumMaxCutClustering class code matching the book."""
    adj_str = repr(adjacency_matrix)
    n = len(adjacency_matrix)
    if framework == "qiskit":
        return _maxcut_qiskit(adj_str, n, opt_params, invert_adjacency)
    elif framework == "pennylane":
        return _maxcut_pennylane(adj_str, n, opt_params, invert_adjacency)
    elif framework == "cirq":
        return _maxcut_cirq(adj_str, n, opt_params, invert_adjacency)
    elif framework == "qsharp":
        return _vqe_qsharp(n, opt_params, 1)
    elif framework == "qasm":
        return _vqe_qasm(n, opt_params, 1)
    return f"# Unsupported framework: {framework}"


def _maxcut_qiskit(adj_str, n, opt_params, invert):
    return f'''# MaxCut Clustering — Qiskit  |  {n} vertices
import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer import AerSimulator
from qiskit_aer.primitives import Estimator
from qiskit.circuit import Parameter
from scipy.optimize import minimize


class QuantumMaxCutClustering:
    """VQE-based MaxCut graph clustering (Qiskit)."""

    def __init__(self, adjacency_matrix, invert_adjacency={invert}):
        self.adjacency_matrix = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.adjacency_matrix.shape[0]
        self.hamiltonian_basis_template = "I" * self.num_vertices
        if invert_adjacency:
            self.hamiltonian = 1 - self.adjacency_matrix
            np.fill_diagonal(self.hamiltonian, 0)
        else:
            self.hamiltonian = self.adjacency_matrix.copy()
            np.fill_diagonal(self.hamiltonian, 0)

    def create_max_cut_hamiltonian(self):
        """Build ZZ Pauli bases and coefficients from distance matrix."""
        hamiltonian_bases, hamiltonian_coefficients = [], []
        for i in range(self.num_vertices):
            for j in range(i + 1, self.num_vertices):
                if self.hamiltonian[i, j] > 0:
                    hamiltonian_coefficients.append(self.hamiltonian[i, j])
                    base = list(self.hamiltonian_basis_template)
                    base[i] = "Z"
                    base[j] = "Z"
                    hamiltonian_bases.append("".join(base))
        return hamiltonian_bases, hamiltonian_coefficients

    def _build_ansatz(self):
        qc = QuantumCircuit(self.num_vertices)
        params = []
        for q in range(self.num_vertices):
            p = Parameter(f"t_{{q}}")
            params.append(p)
            qc.ry(p, q)
        for q in range(self.num_vertices - 1):
            qc.cx(q, q + 1)
        return qc, params

    def vqe_simulation(self, hamiltonian_bases, hamiltonian_coefficients,
                       initial_theta=None, copies=10000):
        """Run VQE optimization."""
        operator = SparsePauliOp(hamiltonian_bases, hamiltonian_coefficients)
        ansatz, params = self._build_ansatz()
        estimator = Estimator()
        history = []

        def cost_fn(theta):
            job = estimator.run([ansatz], [operator], [theta])
            e = float(job.result().values[0])
            history.append(e)
            return e

        if initial_theta is None:
            initial_theta = [0.5] * self.num_vertices
        result = minimize(cost_fn, initial_theta, method="COBYLA",
                          options={{"maxiter": 200}})

        # Measure to get histogram
        bound = ansatz.assign_parameters(
            dict(zip(params, result.x)))
        bound.measure_all()
        sim = AerSimulator()
        counts = sim.run(transpile(bound, sim), shots=copies).result().get_counts()

        solution_stat = max(counts, key=counts.get)
        return result.x.tolist(), float(result.fun), counts, solution_stat

    def max_cut_cluster(self, solution_state):
        """Display cluster assignment."""
        print(f"\nCluster assignment from state |{{solution_state}}⟩:")
        for i, bit in enumerate(solution_state):
            cluster = "A" if bit == "0" else "B"
            print(f"  Vertex {{i}} → Cluster {{cluster}}")

    def main(self):
        bases, coeffs = self.create_max_cut_hamiltonian()
        print("Hamiltonian bases:", bases)
        print("Hamiltonian coefficients:", coeffs)
        theta, energy, counts, solution = self.vqe_simulation(bases, coeffs)
        print(f"VQE Results: Energy={{energy:.4f}} at theta={{theta}}")
        print(f"Histogram: {{counts}}")
        print(f"Solution state: {{solution}}")
        self.max_cut_cluster(solution)


if __name__ == "__main__":
    mc = QuantumMaxCutClustering(
        adjacency_matrix={adj_str},
        invert_adjacency={invert},
    )
    mc.main()
'''


def _maxcut_pennylane(adj_str, n, opt_params, invert):
    return f'''# MaxCut Clustering — PennyLane  |  {n} vertices
import pennylane as qml
import numpy as np
from scipy.optimize import minimize


class QuantumMaxCutClustering:
    """VQE-based MaxCut graph clustering (PennyLane)."""

    def __init__(self, adjacency_matrix, invert_adjacency={invert}):
        self.adjacency_matrix = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.adjacency_matrix.shape[0]
        if invert_adjacency:
            self.hamiltonian = 1 - self.adjacency_matrix
            np.fill_diagonal(self.hamiltonian, 0)
        else:
            self.hamiltonian = self.adjacency_matrix.copy()
            np.fill_diagonal(self.hamiltonian, 0)
        self.dev = qml.device("default.qubit", wires=self.num_vertices)

    def create_max_cut_hamiltonian(self):
        coeffs, ops = [], []
        for i in range(self.num_vertices):
            for j in range(i + 1, self.num_vertices):
                if self.hamiltonian[i, j] > 0:
                    coeffs.append(self.hamiltonian[i, j])
                    ops.append(qml.PauliZ(i) @ qml.PauliZ(j))
        return qml.Hamiltonian(coeffs, ops)

    def vqe_simulation(self, H, copies=10000):
        @qml.qnode(self.dev)
        def circuit(theta):
            for q in range(self.num_vertices):
                qml.RY(theta[q], wires=q)
            for q in range(self.num_vertices - 1):
                qml.CNOT(wires=[q, q + 1])
            return qml.expval(H)

        def cost_fn(theta):
            return float(circuit(theta))

        x0 = np.array([0.5] * self.num_vertices)
        result = minimize(cost_fn, x0, method="COBYLA", options={{"maxiter": 200}})

        @qml.qnode(self.dev)
        def sample_circuit(theta):
            for q in range(self.num_vertices):
                qml.RY(theta[q], wires=q)
            for q in range(self.num_vertices - 1):
                qml.CNOT(wires=[q, q + 1])
            return qml.probs(wires=range(self.num_vertices))

        probs = sample_circuit(result.x)
        solution_idx = int(np.argmax(probs))
        solution = format(solution_idx, f"0{{self.num_vertices}}b")
        return result.x.tolist(), float(result.fun), solution

    def main(self):
        H = self.create_max_cut_hamiltonian()
        theta, energy, solution = self.vqe_simulation(H)
        print(f"Energy: {{energy:.4f}}, Solution: |{{solution}}⟩")
        for i, bit in enumerate(solution):
            print(f"  Vertex {{i}} → Cluster {{\"A\" if bit == \"0\" else \"B\"}}")


if __name__ == "__main__":
    mc = QuantumMaxCutClustering(
        adjacency_matrix={adj_str},
        invert_adjacency={invert},
    )
    mc.main()
'''


def _maxcut_cirq(adj_str, n, opt_params, invert):
    return f'''# MaxCut Clustering — Cirq  |  {n} vertices
import cirq
import numpy as np
from scipy.optimize import minimize


class QuantumMaxCutClustering:
    """VQE-based MaxCut graph clustering (Cirq)."""

    def __init__(self, adjacency_matrix, invert_adjacency={invert}):
        self.adjacency_matrix = np.array(adjacency_matrix, dtype=float)
        self.num_vertices = self.adjacency_matrix.shape[0]
        if invert_adjacency:
            self.hamiltonian = 1 - self.adjacency_matrix
            np.fill_diagonal(self.hamiltonian, 0)
        else:
            self.hamiltonian = self.adjacency_matrix.copy()
            np.fill_diagonal(self.hamiltonian, 0)
        self.qubits = [cirq.LineQubit(i) for i in range(self.num_vertices)]

    def create_max_cut_hamiltonian(self):
        bases, coefficients = [], []
        template = "I" * self.num_vertices
        for i in range(self.num_vertices):
            for j in range(i + 1, self.num_vertices):
                if self.hamiltonian[i, j] > 0:
                    coefficients.append(self.hamiltonian[i, j])
                    base = list(template)
                    base[i] = "Z"
                    base[j] = "Z"
                    bases.append("".join(base))
        return bases, coefficients

    def build_ansatz(self, theta):
        c = cirq.Circuit()
        for q in range(self.num_vertices):
            c.append(cirq.ry(theta[q] * np.pi)(self.qubits[q]))
        for q in range(self.num_vertices - 1):
            c.append(cirq.CNOT(self.qubits[q], self.qubits[q + 1]))
        c.append(cirq.measure(*self.qubits, key="m"))
        return c

    def vqe_simulation(self, bases, coefficients, copies=10000):
        def cost_fn(theta):
            c = self.build_ansatz(theta)
            hist = dict(cirq.Simulator().run(c, repetitions=copies).histogram(key="m"))
            exp = 0
            for base, scale in zip(bases, coefficients):
                for state, count in hist.items():
                    ev = 1
                    bits = format(state, f"0{{self.num_vertices}}b")
                    for i, ch in enumerate(base):
                        if ch == "Z":
                            ev *= 1 if bits[i] == "0" else -1
                    exp += scale * ev * count
            return exp / copies

        x0 = np.array([0.5] * self.num_vertices)
        result = minimize(cost_fn, x0, method="COBYLA", options={{"maxiter": 200}})

        c = self.build_ansatz(result.x)
        hist = dict(cirq.Simulator().run(c, repetitions=copies).histogram(key="m"))
        solution = format(max(hist, key=hist.get), f"0{{self.num_vertices}}b")
        return result.x.tolist(), float(result.fun), hist, solution

    def main(self):
        bases, coeffs = self.create_max_cut_hamiltonian()
        print("Hamiltonian bases:", bases)
        theta, energy, hist, solution = self.vqe_simulation(bases, coeffs)
        print(f"Energy: {{energy:.4f}}, Solution: |{{solution}}⟩")
        for i, bit in enumerate(solution):
            print(f"  Vertex {{i}} → Cluster {{\"A\" if bit == \"0\" else \"B\"}}")


if __name__ == "__main__":
    mc = QuantumMaxCutClustering(
        adjacency_matrix={adj_str},
        invert_adjacency={invert},
    )
    mc.main()
'''
