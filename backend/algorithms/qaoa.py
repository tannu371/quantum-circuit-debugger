from __future__ import annotations

"""
qaoa.py — QAOA engine + class-based code generation.

Execution:
    build_qaoa_circuit()   — Construct QAOA circuit with ZZ + Z cost layers.
    run_qaoa()             — Full optimisation + measurement.

Code generation:
    generate_qaoa_code()   — Modular, class-based code for 5 frameworks.
"""

from qiskit import QuantumCircuit, transpile
from qiskit_aer.primitives import Estimator
from qiskit_aer import AerSimulator
from scipy.optimize import minimize
import numpy as np

from algorithms.hamiltonian import build_ising_hamiltonian


# ═══════════════════════════════════════════════════════════════════════════
#  Circuit builder
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


# ═══════════════════════════════════════════════════════════════════════════
#  Execution
# ═══════════════════════════════════════════════════════════════════════════


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
#  Class-based code generation
# ═══════════════════════════════════════════════════════════════════════════


def generate_qaoa_code(
    num_qubits: int,
    interaction_matrix: list[list[float]],
    opt_gammas: list[float],
    opt_betas: list[float],
    framework: str = "qiskit",
    linear_terms: list[float] | None = None,
) -> str:
    n = num_qubits
    mat = interaction_matrix
    lt = linear_terms or [0.0] * n

    if framework == "qiskit":
        return _qaoa_qiskit(n, mat, lt, opt_gammas, opt_betas)
    elif framework == "pennylane":
        return _qaoa_pennylane(n, mat, lt, opt_gammas, opt_betas)
    elif framework == "cirq":
        return _qaoa_cirq(n, mat, lt, opt_gammas, opt_betas)
    elif framework == "qsharp":
        return _qaoa_qsharp(n, mat, lt, opt_gammas, opt_betas)
    elif framework == "qasm":
        return _qaoa_qasm(n, mat, lt, opt_gammas, opt_betas)
    return f"# Unsupported: {framework}"


# ── Qiskit ────────────────────────────────────────────────────────────────


def _qaoa_qiskit(n, mat, lt, gammas, betas):
    return f'''# QAOA — Qiskit  |  {n} qubits, {len(gammas)} layer(s)
# H = Σ J_ij Z_i Z_j + Σ h_i Z_i
import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit_aer.primitives import Estimator
from qiskit.quantum_info import SparsePauliOp
from scipy.optimize import minimize


class QAOA:
    """Generalized Ising QAOA solver."""

    def __init__(self, num_qubits: int,
                 hamiltonian_interactions: np.ndarray,
                 linear_terms: np.ndarray | None = None):
        self.num_qubits = num_qubits
        self.hamiltonian_interactions = np.array(hamiltonian_interactions, dtype=float)
        self.linear_terms = (
            np.array(linear_terms, dtype=float) if linear_terms is not None
            else np.zeros(num_qubits)
        )
        self.circuit = None

    # ------ Cost layer: ZZ interactions ------
    @staticmethod
    def interaction_gate(qc, q1, q2, gamma, J):
        """Decompose exp(-i γ J Z_i Z_j) into native gates."""
        qc.cx(q1, q2)
        qc.rz(2 * gamma * J, q2)
        qc.cx(q1, q2)

    def target_hamiltonian_evolution(self, qc, gamma):
        """Apply cost unitary (ZZ + Z terms)."""
        for i in range(self.num_qubits):
            for j in range(i + 1, self.num_qubits):
                J = self.hamiltonian_interactions[i, j]
                if J != 0:
                    self.interaction_gate(qc, i, j, gamma, J)
        # Single-Z fields
        for i in range(self.num_qubits):
            h = self.linear_terms[i]
            if h != 0:
                qc.rz(2 * gamma * h, i)

    # ------ Mixer layer ------
    def mixer_hamiltonian_evolution(self, qc, beta):
        """Apply mixer unitary: Σ X_i."""
        for q in range(self.num_qubits):
            qc.rx(2 * beta, q)

    # ------ Build QAOA circuit ------
    def build_qaoa_circuit(self, gammas, betas):
        self.circuit = QuantumCircuit(self.num_qubits)
        for q in range(self.num_qubits):
            self.circuit.h(q)
        for gamma, beta in zip(gammas, betas):
            self.target_hamiltonian_evolution(self.circuit, gamma)
            self.mixer_hamiltonian_evolution(self.circuit, beta)

    # ------ Simulate ------
    def simulate(self, shots=1024):
        meas = self.circuit.copy()
        meas.measure_all()
        sim = AerSimulator()
        result = sim.run(transpile(meas, sim), shots=shots).result()
        return result.get_counts()

    # ------ Expectation ------
    def expectation(self, counts):
        total_shots = sum(counts.values())
        exp_val = 0.0
        for bitstring, count in counts.items():
            spins = np.array([1 if b == "0" else -1 for b in bitstring])
            zz = np.sum(self.hamiltonian_interactions * np.outer(spins, spins))
            z = np.dot(self.linear_terms, spins)
            exp_val += (zz + z) * count
        return exp_val / total_shots

    # ------ Optimise ------
    def optimize_params(self, p_layers=1, max_iter=100, method="COBYLA"):
        history = []
        operator = self._build_operator()
        estimator = Estimator()

        def cost_fn(params):
            gammas = params[:p_layers].tolist()
            betas = params[p_layers:].tolist()
            self.build_qaoa_circuit(gammas, betas)
            job = estimator.run([self.circuit], [operator], [[]])
            val = float(job.result().values[0])
            history.append(val)
            return val

        x0 = np.concatenate([
            np.random.uniform(0, np.pi, p_layers),
            np.random.uniform(0, np.pi / 2, p_layers),
        ])
        result = minimize(cost_fn, x0, method=method,
                          options={{"maxiter": max_iter}})
        opt_gammas = result.x[:p_layers].tolist()
        opt_betas = result.x[p_layers:].tolist()
        return opt_gammas, opt_betas, result.fun, history

    def _build_operator(self):
        pauli, coeffs = [], []
        n = self.num_qubits
        for i in range(n):
            for j in range(i + 1, n):
                J = self.hamiltonian_interactions[i, j]
                if J != 0:
                    op = ["I"] * n
                    op[n - 1 - i] = "Z"; op[n - 1 - j] = "Z"
                    pauli.append("".join(op)); coeffs.append(J)
        for i in range(n):
            h = self.linear_terms[i]
            if h != 0:
                op = ["I"] * n; op[n - 1 - i] = "Z"
                pauli.append("".join(op)); coeffs.append(h)
        if not pauli:
            return SparsePauliOp(["I" * n], [0.0])
        return SparsePauliOp(pauli, coeffs)


if __name__ == "__main__":
    interaction = np.array({[list(row) for row in mat]})
    linear = np.array({list(lt)})

    qaoa = QAOA(num_qubits={n},
                hamiltonian_interactions=interaction,
                linear_terms=linear)

    # Pre-computed optimal parameters
    opt_gammas = {list(gammas)}
    opt_betas = {list(betas)}

    qaoa.build_qaoa_circuit(opt_gammas, opt_betas)
    counts = qaoa.simulate(shots=1024)
    print("Measurement counts:", counts)
    print("Most likely state :", max(counts, key=counts.get))
    print("Expectation value :", qaoa.expectation(counts))
'''


# ── PennyLane ─────────────────────────────────────────────────────────────


def _qaoa_pennylane(n, mat, lt, gammas, betas):
    return f'''# QAOA — PennyLane  |  {n} qubits, {len(gammas)} layer(s)
import pennylane as qml
import numpy as np


class QAOA:
    """Generalized Ising QAOA solver (PennyLane)."""

    def __init__(self, num_qubits, hamiltonian_interactions, linear_terms=None):
        self.num_qubits = num_qubits
        self.H = np.array(hamiltonian_interactions, dtype=float)
        self.h = (np.array(linear_terms, dtype=float) if linear_terms is not None
                  else np.zeros(num_qubits))
        self.dev = qml.device("default.qubit", wires=num_qubits, shots=1024)

    def target_hamiltonian_evolution(self, gamma):
        for i in range(self.num_qubits):
            for j in range(i + 1, self.num_qubits):
                J = self.H[i, j]
                if J != 0:
                    qml.CNOT(wires=[i, j])
                    qml.RZ(2 * gamma * J, wires=j)
                    qml.CNOT(wires=[i, j])
        for i in range(self.num_qubits):
            if self.h[i] != 0:
                qml.RZ(2 * gamma * self.h[i], wires=i)

    def mixer_hamiltonian_evolution(self, beta):
        for q in range(self.num_qubits):
            qml.RX(2 * beta, wires=q)

    def build_and_run(self, gammas, betas):
        @qml.qnode(self.dev)
        def circuit():
            for q in range(self.num_qubits):
                qml.Hadamard(wires=q)
            for gamma, beta in zip(gammas, betas):
                self.target_hamiltonian_evolution(gamma)
                self.mixer_hamiltonian_evolution(beta)
            return qml.counts()
        return circuit()

    def expectation(self, counts):
        total = sum(counts.values())
        exp_val = 0.0
        for bitstring, count in counts.items():
            spins = np.array([1 if b == "0" else -1 for b in bitstring])
            zz = np.sum(self.H * np.outer(spins, spins))
            z = np.dot(self.h, spins)
            exp_val += (zz + z) * count
        return exp_val / total


if __name__ == "__main__":
    qaoa = QAOA(
        num_qubits={n},
        hamiltonian_interactions={[list(row) for row in mat]},
        linear_terms={list(lt)},
    )
    opt_gammas = {list(gammas)}
    opt_betas = {list(betas)}
    counts = qaoa.build_and_run(opt_gammas, opt_betas)
    print("Counts:", counts)
    print("Expectation:", qaoa.expectation(counts))
'''


# ── Cirq ──────────────────────────────────────────────────────────────────


def _qaoa_cirq(n, mat, lt, gammas, betas):
    return f'''# QAOA — Cirq  |  {n} qubits, {len(gammas)} layer(s)
import cirq
import numpy as np


class QAOA:
    """Generalized Ising QAOA solver (Cirq)."""

    def __init__(self, num_elems, hamiltonian_interactions, linear_terms=None):
        self.num_elems = num_elems
        self.hamiltonian_interactions = np.array(hamiltonian_interactions, dtype=float)
        self.linear_terms = (
            np.array(linear_terms, dtype=float) if linear_terms is not None
            else np.zeros(num_elems)
        )
        self.qubits = [cirq.LineQubit(x) for x in range(num_elems)]

    @staticmethod
    def interaction_gate(q1, q2, gamma):
        """ZZ interaction gate via CZ decomposition."""
        circuit = cirq.Circuit()
        circuit.append(cirq.CZ(q1, q2) ** gamma)
        circuit.append([cirq.X(q2), cirq.CZ(q1, q2) ** (-gamma), cirq.X(q2)])
        circuit.append([cirq.X(q1), cirq.CZ(q1, q2) ** (-gamma), cirq.X(q1)])
        circuit.append([cirq.X(q1), cirq.X(q2),
                        cirq.CZ(q1, q2) ** gamma, cirq.X(q1), cirq.X(q2)])
        return circuit

    def target_hamiltonian_evolution_circuit(self, gamma):
        circuit = cirq.Circuit()
        for i in range(self.num_elems):
            for j in range(i + 1, self.num_elems):
                if self.hamiltonian_interactions[i, j] != 0:
                    circuit.append(self.interaction_gate(
                        self.qubits[i], self.qubits[j], gamma=gamma))
        for i in range(self.num_elems):
            h = self.linear_terms[i]
            if h != 0:
                circuit.append(cirq.rz(2 * gamma * h)(self.qubits[i]))
        return circuit

    def starting_hamiltonian_evolution_circuit(self, beta):
        for i in range(self.num_elems):
            yield cirq.X(self.qubits[i]) ** beta

    def build_qaoa_circuit(self, gamma_store, beta_store):
        self.circuit = cirq.Circuit()
        self.circuit.append(cirq.H.on_each(*self.qubits))
        for i in range(len(gamma_store)):
            self.circuit.append(
                self.target_hamiltonian_evolution_circuit(gamma_store[i]))
            self.circuit.append(
                self.starting_hamiltonian_evolution_circuit(beta_store[i]))

    def simulate(self):
        sim = cirq.Simulator()
        waveform = sim.simulate(self.circuit)
        return waveform

    def expectation(self, waveform):
        expectation = 0
        prob_from_waveform = (np.absolute(waveform.final_state_vector)) ** 2
        for i in range(len(prob_from_waveform)):
            base = bin(i).replace("0b", "")
            base = (self.num_elems - len(base)) * "0" + base
            base_array = np.array([-1 if int(b) == 0 else 1 for b in base])
            base_interactions = np.outer(base_array, base_array)
            expectation += prob_from_waveform[i] * (
                np.sum(np.multiply(base_interactions, self.hamiltonian_interactions))
                + np.dot(self.linear_terms, base_array)
            )
        return expectation

    def optimize_params(self, gammas, betas, verbose=True):
        expectation_dict = {{}}
        waveforms_dict = {{}}
        for gamma in gammas:
            for beta in betas:
                self.build_qaoa_circuit([gamma], [beta])
                waveform = self.simulate()
                exp = self.expectation(waveform)
                expectation_dict[(gamma, beta)] = exp
                waveforms_dict[(gamma, beta)] = waveform.final_state_vector
                if verbose:
                    print(f"Expectation for gamma:{{gamma:.4f}}, "
                          f"beta:{{beta:.4f}} = {{exp:.6f}}")
        return expectation_dict, waveforms_dict

    def main(self):
        gammas = np.linspace(0, 1, 50)
        betas = np.linspace(0, np.pi, 50)
        exp_dict, wf_dict = self.optimize_params(gammas, betas)
        exp_vals = np.array(list(exp_dict.values()))
        exp_params = list(exp_dict.keys())
        wf_vals = np.array(list(wf_dict.values()))
        optim_param = exp_params[np.argmin(exp_vals)]
        optim_exp = exp_vals[np.argmin(exp_vals)]
        optim_wf = wf_vals[np.argmin(exp_vals)]
        optim_probs = [np.abs(x) ** 2 for x in optim_wf]
        optim_state = np.argmax(optim_probs)
        optim_state_str = bin(optim_state).replace("0b", "")
        optim_state_str = "0" * (self.num_elems - len(optim_state_str)) + optim_state_str
        print(f"Optimized parameters:")
        print(f"  gamma, beta = {{optim_param[0]:.4f}}, {{optim_param[1]:.4f}}")
        print(f"  Expectation = {{optim_exp:.6f}}")
        print(f"  Probabilities = {{[f'{{p:.4f}}' for p in optim_probs]}}")
        print(f"  Lowest eigenstate: |{{optim_state_str}}>")
        return exp_dict


if __name__ == "__main__":
    hamiltonian_interaction = np.array({[list(row) for row in mat]})
    qaoa_obj = QAOA(
        num_elems={n},
        hamiltonian_interactions=hamiltonian_interaction,
        linear_terms={list(lt)},
    )
    # Run with pre-computed optimal parameters
    qaoa_obj.build_qaoa_circuit({list(gammas)}, {list(betas)})
    wf = qaoa_obj.simulate()
    print("Expectation:", qaoa_obj.expectation(wf))

    # Or run full grid search:
    # qaoa_obj.main()
'''


# ── Q# ───────────────────────────────────────────────────────────────────


def _qaoa_qsharp(n, mat, lt, gammas, betas):
    p = len(gammas)
    # Build inline gate blocks
    cost_block = ""
    for i in range(n):
        for j in range(i + 1, n):
            J = mat[i][j]
            if J != 0:
                cost_block += f"            CNOT(q[{i}],q[{j}]); Rz(2.0*g*{J},q[{j}]); CNOT(q[{i}],q[{j}]);\n"
    for i in range(n):
        if lt[i] != 0:
            cost_block += f"            Rz(2.0*g*{lt[i]},q[{i}]);\n"

    return f'''// QAOA — Q#  |  {n} qubits, {p} layer(s)
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
{cost_block}            for i in 0..{n-1} {{ Rx(2.0*b, q[i]); }}
        }}
        mutable r = [];
        for i in 0..{n-1} {{ set r += [M(q[i])]; }}
        ResetAll(q);
        return r;
    }}
}}'''


# ── OpenQASM ──────────────────────────────────────────────────────────────


def _qaoa_qasm(n, mat, lt, gammas, betas):
    p = len(gammas)
    code = f"// QAOA — QASM 2.0  |  {n} qubits, {p} layer(s)\nOPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[{n}];\ncreg c[{n}];\n\n"
    for q in range(n):
        code += f"h q[{q}];\n"
    for layer in range(p):
        g, b = gammas[layer], betas[layer]
        code += f"\n// Layer {layer+1} — Cost\n"
        for i in range(n):
            for j in range(i + 1, n):
                J = mat[i][j]
                if J != 0:
                    code += f"cx q[{i}],q[{j}];\nrz({2*g*J}) q[{j}];\ncx q[{i}],q[{j}];\n"
        for i in range(n):
            if lt[i] != 0:
                code += f"rz({2*g*lt[i]}) q[{i}];\n"
        code += f"\n// Layer {layer+1} — Mixer\n"
        for q in range(n):
            code += f"rx({2*b}) q[{q}];\n"
    code += "\nmeasure q -> c;\n"
    return code
