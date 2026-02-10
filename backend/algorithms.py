"""
algorithms.py — VQE / QAOA variational algorithm engine.

Supports the full generalized Ising Hamiltonian:

    H = Σ_{i<j} J_{ij} Z_i Z_j  +  Σ_i h_i Z_i

This enables:
  • MaxCut, Ising chains, complete graphs  (ZZ terms)
  • Minimum Vertex Cover, QUBO            (ZZ + Z terms)
  • Weighted MaxCut, Portfolio Optimization (weighted ZZ + Z)
  • Arbitrary Pauli Hamiltonians            (VQE bases+scales)

Code generation: Qiskit, PennyLane, Cirq, Q#, OpenQASM.
"""

from qiskit import QuantumCircuit
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer.primitives import Estimator
from qiskit_aer import AerSimulator
from qiskit import transpile
from qiskit.circuit import Parameter
from scipy.optimize import minimize
import numpy as np
import re


# ═══════════════════════════════════════════════════════════════════════════
#  Hamiltonian builders
# ═══════════════════════════════════════════════════════════════════════════


def parse_hamiltonian(hamiltonian_str: str, num_qubits: int) -> SparsePauliOp:
    """Parse ``"Z0 Z1 + 0.5 * X0"`` → SparsePauliOp (little-endian)."""
    try:
        terms = hamiltonian_str.split("+")
        pauli_list: list[str] = []
        coeffs: list[float] = []
        for term in terms:
            term = term.strip()
            if not term:
                continue
            coeff = 1.0
            pauli_part = term
            if "*" in term:
                parts = term.split("*")
                try:
                    coeff = float(parts[0].strip())
                    pauli_part = parts[1].strip()
                except ValueError:
                    pass
            else:
                parts = term.split()
                try:
                    if parts:
                        coeff = float(parts[0])
                        pauli_part = " ".join(parts[1:])
                except ValueError:
                    pass
            op_list = ["I"] * num_qubits
            for match in re.finditer(r"([XYZ])(\d+)", pauli_part, re.IGNORECASE):
                gate = match.group(1).upper()
                idx = int(match.group(2))
                if idx < num_qubits:
                    op_list[num_qubits - 1 - idx] = gate
            pauli_list.append("".join(op_list))
            coeffs.append(coeff)
        if not pauli_list:
            return SparsePauliOp(["I" * num_qubits], [0.0])
        return SparsePauliOp(pauli_list, coeffs)
    except Exception as e:
        print(f"Error parsing Hamiltonian: {e}")
        return SparsePauliOp(["I" * num_qubits], [0.0])


def bases_scales_to_hamiltonian(
    hamiltonian_bases: list[str],
    hamiltonian_scales: list[float],
) -> SparsePauliOp:
    """``["ZZ", "ZI"]`` + ``[-1, -1]`` → SparsePauliOp."""
    return SparsePauliOp(hamiltonian_bases, hamiltonian_scales)


def build_ising_hamiltonian(
    num_qubits: int,
    interaction_matrix: list[list[float]],
    linear_terms: list[float] | None = None,
) -> SparsePauliOp:
    """
    Build a generalised Ising Hamiltonian:

        H = Σ_{i<j} J_{ij} Z_i Z_j  +  Σ_i h_i Z_i

    Args:
        num_qubits:         Number of qubits.
        interaction_matrix: Upper-triangular coupling matrix J_{ij}.
        linear_terms:       Single-qubit field strengths h_i (optional).
    """
    pauli_list: list[str] = []
    coeffs: list[float] = []

    # ZZ terms
    for i in range(num_qubits):
        for j in range(i + 1, num_qubits):
            J = interaction_matrix[i][j]
            if J != 0:
                op = ["I"] * num_qubits
                op[num_qubits - 1 - i] = "Z"
                op[num_qubits - 1 - j] = "Z"
                pauli_list.append("".join(op))
                coeffs.append(J)

    # Single-Z terms
    if linear_terms:
        for i in range(num_qubits):
            h = linear_terms[i]
            if h != 0:
                op = ["I"] * num_qubits
                op[num_qubits - 1 - i] = "Z"
                pauli_list.append("".join(op))
                coeffs.append(h)

    if not pauli_list:
        return SparsePauliOp(["I" * num_qubits], [0.0])

    return SparsePauliOp(pauli_list, coeffs)


# ── Problem generators ────────────────────────────────────────────────────


def mvc_hamiltonian(
    adjacency_matrix: list[list[float]],
    num_qubits: int,
) -> tuple[list[list[float]], list[float]]:
    """
    Generate Minimum Vertex Cover Hamiltonian terms.

    H_C = Σ_{(i,j)∈E} (3/4)(Z_i Z_j + Z_i + Z_j) − Σ_{i∈V} Z_i

    Returns (interaction_matrix, linear_terms).
    """
    J = [[0.0] * num_qubits for _ in range(num_qubits)]
    h = [0.0] * num_qubits

    for i in range(num_qubits):
        for j in range(i + 1, num_qubits):
            if adjacency_matrix[i][j] != 0:
                # ZZ term: 3/4
                J[i][j] += 0.75
                # Z_i and Z_j terms from edge: 3/4 each
                h[i] += 0.75
                h[j] += 0.75

    # Vertex penalty: −Z_i for each vertex
    for i in range(num_qubits):
        h[i] -= 1.0

    return J, h


def weighted_maxcut_hamiltonian(
    adjacency_matrix: list[list[float]],
    num_qubits: int,
) -> tuple[list[list[float]], list[float]]:
    """
    Weighted MaxCut: H = −Σ_{(i,j)∈E} w_{ij} Z_i Z_j.

    Returns (interaction_matrix, linear_terms=[0,...,0]).
    """
    J = [[0.0] * num_qubits for _ in range(num_qubits)]
    for i in range(num_qubits):
        for j in range(i + 1, num_qubits):
            if adjacency_matrix[i][j] != 0:
                J[i][j] = -adjacency_matrix[i][j]
    return J, [0.0] * num_qubits


# ═══════════════════════════════════════════════════════════════════════════
#  VQE — Full Standalone Implementation
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


# Legacy VQE (circuit-based ansatz, backward compat)
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
#  VQE code generation
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


def _vqe_qiskit(n, bases, scales, params, depth):
    return f"""# VQE — Qiskit  |  {n} qubits, depth {depth}
from qiskit import QuantumCircuit, transpile
from qiskit.quantum_info import SparsePauliOp
from qiskit_aer import AerSimulator
from qiskit_aer.primitives import Estimator
from qiskit.circuit import Parameter
from scipy.optimize import minimize
import numpy as np

n = {n}
hamiltonian = SparsePauliOp({bases}, {scales})

# RY ansatz
qc = QuantumCircuit(n)
params = []
for layer in range({depth}):
    for q in range(n):
        p = Parameter(f"t_{{layer}}_{{q}}")
        params.append(p)
        qc.ry(p, q)
    for q in range(n - 1):
        qc.cx(q, q + 1)

optimal_params = {params}

# Bind & simulate
bound = qc.assign_parameters(dict(zip(params, optimal_params)))
bound.measure_all()
sim = AerSimulator()
result = sim.run(transpile(bound, sim), shots=1024).result()
counts = result.get_counts()
print("Counts:", counts)
print("Most likely:", max(counts, key=counts.get))
"""


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
    return f"""# VQE — PennyLane  |  {n} qubits, depth {depth}
import pennylane as qml
import numpy as np

dev = qml.device("default.qubit", wires={n})
coeffs_obs = [
{chr(10).join(obs_lines)}
]
H = qml.Hamiltonian([c for c,_ in coeffs_obs], [o for _,o in coeffs_obs])

@qml.qnode(dev)
def vqe(params):
    idx = 0
    for layer in range({depth}):
        for q in range({n}):
            qml.RY(params[idx], wires=q); idx += 1
        for q in range({n}-1):
            qml.CNOT(wires=[q, q+1])
    return qml.expval(H)

optimal = np.array({params})
print("Energy:", vqe(optimal))
"""


def _vqe_cirq(n, bases, scales, params, depth):
    return f"""# VQE — Cirq  |  {n} qubits, depth {depth}
import cirq, numpy as np
from scipy.optimize import minimize

qubits = [cirq.LineQubit(i) for i in range({n})]
bases = {bases}
scales = {scales}

def build_ansatz(theta):
    c = cirq.Circuit()
    idx = 0
    for layer in range({depth}):
        for q in range({n}):
            c.append(cirq.ry(theta[idx]*np.pi)(qubits[q])); idx += 1
        for q in range({n}-1):
            c.append(cirq.CNOT(qubits[q], qubits[q+1]))
    c.append(cirq.measure(*qubits, key='m'))
    return c

def expectation(theta, copies=10000):
    c = build_ansatz(theta)
    hist = dict(cirq.Simulator().run(c, repetitions=copies).histogram(key='m'))
    exp = 0
    for base, scale in zip(bases, scales):
        for state, count in hist.items():
            ev = 1
            bits = format(state, f'0{{{n}}}b')
            for i, ch in enumerate(base):
                if ch == 'Z': ev *= (1 if bits[i]=='0' else -1)
            exp += scale * ev * count
    return exp / copies

optimal = {params}
print("Energy:", expectation(optimal))
"""


def _vqe_qsharp(n, params, depth):
    return f"""// VQE Ansatz — Q#  |  {n} qubits, depth {depth}
namespace VQE {{
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Measurement;
    @EntryPoint()
    operation Run() : Result[] {{
        use q = Qubit[{n}];
        let theta = {params};
        mutable idx = 0;
        for layer in 0..{depth-1} {{
            for i in 0..{n-1} {{ Ry(theta[idx], q[i]); set idx += 1; }}
            for i in 0..{n-2} {{ CNOT(q[i], q[i+1]); }}
        }}
        mutable r = [];
        for i in 0..{n-1} {{ set r += [M(q[i])]; }}
        ResetAll(q);
        return r;
    }}
}}"""


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
#  QAOA — Full Generalised Implementation
# ═══════════════════════════════════════════════════════════════════════════


def build_qaoa_circuit(
    num_qubits: int,
    interaction_matrix: list[list[float]],
    gammas: list[float],
    betas: list[float],
    linear_terms: list[float] | None = None,
) -> QuantumCircuit:
    """
    Build a QAOA circuit for the generalised Ising Hamiltonian:

        H = Σ_{i<j} J_{ij} Z_i Z_j  +  Σ_i h_i Z_i

    Cost layer:
      • ZZ interactions:  CNOT(i,j) → RZ(2γJ) → CNOT(i,j)
      • Single-Z fields:  RZ(2γh_i) on qubit i

    Mixer layer:
      • RX(2β) on each qubit
    """
    p = len(gammas)
    qc = QuantumCircuit(num_qubits)

    # Initial superposition
    for q in range(num_qubits):
        qc.h(q)

    for layer in range(p):
        gamma = gammas[layer]
        beta = betas[layer]

        # Cost: ZZ interactions
        for i in range(num_qubits):
            for j in range(i + 1, num_qubits):
                J = interaction_matrix[i][j]
                if J != 0:
                    qc.cx(i, j)
                    qc.rz(2 * gamma * J, j)
                    qc.cx(i, j)

        # Cost: single-qubit Z fields
        if linear_terms:
            for i in range(num_qubits):
                h = linear_terms[i]
                if h != 0:
                    qc.rz(2 * gamma * h, i)

        # Mixer
        for q in range(num_qubits):
            qc.rx(2 * beta, q)

    return qc


def run_qaoa(
    num_qubits: int,
    interaction_matrix: list[list[float]],
    p_layers: int = 1,
    max_iter: int = 100,
    method: str = "COBYLA",
    shots: int = 1024,
    linear_terms: list[float] | None = None,
) -> dict:
    """
    Run full QAOA for generalised Ising H = Σ J_{ij} ZZ + Σ h_i Z.
    """
    operator = build_ising_hamiltonian(num_qubits, interaction_matrix, linear_terms)
    estimator = Estimator()
    history: list[float] = []

    def cost_func(params):
        gammas = params[:p_layers].tolist()
        betas = params[p_layers:].tolist()
        qc = build_qaoa_circuit(num_qubits, interaction_matrix, gammas, betas, linear_terms)
        job = estimator.run([qc], [operator], [[]])
        energy = float(job.result().values[0])
        history.append(energy)
        return energy

    x0 = np.concatenate([
        np.random.uniform(0, np.pi, p_layers),
        np.random.uniform(0, np.pi / 2, p_layers),
    ])
    result = minimize(cost_func, x0, method=method, options={"maxiter": max_iter})

    opt_gammas = result.x[:p_layers].tolist()
    opt_betas = result.x[p_layers:].tolist()
    opt_circuit = build_qaoa_circuit(num_qubits, interaction_matrix, opt_gammas, opt_betas, linear_terms)

    # Statevector
    sim_sv = AerSimulator(method="statevector")
    sv_qc = opt_circuit.copy()
    sv_qc.save_statevector()
    sv_result = sim_sv.run(transpile(sv_qc, sim_sv)).result()
    statevector = sv_result.get_statevector(sv_qc)
    probs = [float(abs(a) ** 2) for a in np.asarray(statevector)]

    # Counts
    meas_qc = opt_circuit.copy()
    meas_qc.measure_all()
    sim_qasm = AerSimulator()
    meas_result = sim_qasm.run(transpile(meas_qc, sim_qasm), shots=shots).result()
    counts = meas_result.get_counts(meas_qc)
    most_likely = max(counts, key=counts.get)

    return {
        "status": "completed",
        "optimal_energy": float(result.fun),
        "optimal_gammas": opt_gammas,
        "optimal_betas": opt_betas,
        "optimal_params": result.x.tolist(),
        "history": history,
        "message": result.message if hasattr(result, "message") else "Optimization complete.",
        "counts": counts,
        "probabilities": probs,
        "most_likely_state": most_likely,
        "p_layers": p_layers,
        "num_qubits": num_qubits,
        "interaction_matrix": interaction_matrix,
        "linear_terms": linear_terms or [0.0] * num_qubits,
    }


# ═══════════════════════════════════════════════════════════════════════════
#  QAOA code generation
# ═══════════════════════════════════════════════════════════════════════════


def generate_qaoa_code(
    num_qubits: int,
    interaction_matrix: list[list[float]],
    opt_gammas: list[float],
    opt_betas: list[float],
    framework: str = "qiskit",
    linear_terms: list[float] | None = None,
) -> str:
    p = len(opt_gammas)
    pairs = []
    for i in range(num_qubits):
        for j in range(i + 1, num_qubits):
            J = interaction_matrix[i][j]
            if J != 0:
                pairs.append((i, j, J))
    fields = []
    if linear_terms:
        for i in range(num_qubits):
            if linear_terms[i] != 0:
                fields.append((i, linear_terms[i]))

    if framework == "qiskit":
        return _qaoa_qiskit(num_qubits, pairs, fields, opt_gammas, opt_betas, p)
    elif framework == "pennylane":
        return _qaoa_pennylane(num_qubits, pairs, fields, opt_gammas, opt_betas, p)
    elif framework == "cirq":
        return _qaoa_cirq(num_qubits, pairs, fields, opt_gammas, opt_betas, p)
    elif framework == "qsharp":
        return _qaoa_qsharp(num_qubits, pairs, fields, opt_gammas, opt_betas, p)
    elif framework == "qasm":
        return _qaoa_qasm(num_qubits, pairs, fields, opt_gammas, opt_betas, p)
    return f"# Unsupported: {framework}"


def _qaoa_qiskit(n, pairs, fields, gammas, betas, p):
    code = f"""# QAOA — Qiskit  |  {n} qubits, {p} layer(s)
# H = Σ J_ij Z_i Z_j + Σ h_i Z_i
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator

qc = QuantumCircuit({n})
for q in range({n}): qc.h(q)

gammas = {gammas}
betas = {betas}

for layer in range({p}):
    gamma = gammas[layer]
    beta = betas[layer]

    # ZZ interactions
"""
    for i, j, J in pairs:
        code += f"    qc.cx({i}, {j})\n    qc.rz(2*gamma*{J}, {j})\n    qc.cx({i}, {j})\n"
    if fields:
        code += "\n    # Single-Z fields\n"
        for i, h in fields:
            code += f"    qc.rz(2*gamma*{h}, {i})\n"
    code += f"""
    # Mixer
    for q in range({n}): qc.rx(2*beta, q)

qc.measure_all()
sim = AerSimulator()
result = sim.run(transpile(qc, sim), shots=1024).result()
counts = result.get_counts()
print("Counts:", counts)
print("Most likely:", max(counts, key=counts.get))
"""
    return code


def _qaoa_pennylane(n, pairs, fields, gammas, betas, p):
    code = f"""# QAOA — PennyLane  |  {n} qubits, {p} layer(s)
import pennylane as qml

dev = qml.device("default.qubit", wires={n}, shots=1024)
gammas = {gammas}
betas = {betas}

@qml.qnode(dev)
def qaoa():
    for q in range({n}): qml.Hadamard(wires=q)
    for layer in range({p}):
        gamma = gammas[layer]; beta = betas[layer]
"""
    for i, j, J in pairs:
        code += f"        qml.CNOT(wires=[{i},{j}])\n        qml.RZ(2*gamma*{J}, wires={j})\n        qml.CNOT(wires=[{i},{j}])\n"
    for i, h in fields:
        code += f"        qml.RZ(2*gamma*{h}, wires={i})\n"
    code += f"""        for q in range({n}): qml.RX(2*beta, wires=q)
    return qml.counts()

print(qaoa())
"""
    return code


def _qaoa_cirq(n, pairs, fields, gammas, betas, p):
    code = f"""# QAOA — Cirq  |  {n} qubits, {p} layer(s)
import cirq

qubits = [cirq.LineQubit(i) for i in range({n})]
c = cirq.Circuit()
gammas = {gammas}
betas = {betas}

c.append(cirq.H.on_each(*qubits))
for layer in range({p}):
    gamma = gammas[layer]; beta = betas[layer]
"""
    for i, j, J in pairs:
        code += f"    c.append(cirq.CNOT(qubits[{i}], qubits[{j}]))\n    c.append(cirq.rz(2*gamma*{J})(qubits[{j}]))\n    c.append(cirq.CNOT(qubits[{i}], qubits[{j}]))\n"
    for i, h in fields:
        code += f"    c.append(cirq.rz(2*gamma*{h})(qubits[{i}]))\n"
    code += f"""    for q in qubits: c.append(cirq.rx(2*beta)(q))
c.append(cirq.measure(*qubits, key='r'))
print(cirq.Simulator().run(c, repetitions=1024).histogram(key='r'))
"""
    return code


def _qaoa_qsharp(n, pairs, fields, gammas, betas, p):
    code = f"""// QAOA — Q#  |  {n} qubits, {p} layer(s)
namespace QAOA {{
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Measurement;
    @EntryPoint()
    operation Run() : Result[] {{
        use q = Qubit[{n}];
        for i in 0..{n-1} {{ H(q[i]); }}
        let gammas = {gammas};
        let betas = {betas};
        for layer in 0..{p-1} {{
            let g = gammas[layer]; let b = betas[layer];
"""
    for i, j, J in pairs:
        code += f"            CNOT(q[{i}],q[{j}]); Rz(2.0*g*{J},q[{j}]); CNOT(q[{i}],q[{j}]);\n"
    for i, h in fields:
        code += f"            Rz(2.0*g*{h},q[{i}]);\n"
    code += f"""            for i in 0..{n-1} {{ Rx(2.0*b, q[i]); }}
        }}
        mutable r = [];
        for i in 0..{n-1} {{ set r += [M(q[i])]; }}
        ResetAll(q);
        return r;
    }}
}}"""
    return code


def _qaoa_qasm(n, pairs, fields, gammas, betas, p):
    code = f"// QAOA — QASM 2.0  |  {n} qubits, {p} layer(s)\nOPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[{n}];\ncreg c[{n}];\n\n"
    for q in range(n):
        code += f"h q[{q}];\n"
    for layer in range(p):
        g, b = gammas[layer], betas[layer]
        code += f"\n// Layer {layer+1} — Cost\n"
        for i, j, J in pairs:
            code += f"cx q[{i}],q[{j}];\nrz({2*g*J}) q[{j}];\ncx q[{i}],q[{j}];\n"
        for i, h in fields:
            code += f"rz({2*g*h}) q[{i}];\n"
        code += f"\n// Layer {layer+1} — Mixer\n"
        for q in range(n):
            code += f"rx({2*b}) q[{q}];\n"
    code += "\nmeasure q -> c;\n"
    return code
