from __future__ import annotations

"""
hamiltonian.py — Shared Hamiltonian builders & problem generators.

Provides:
    parse_hamiltonian()            — string → SparsePauliOp
    bases_scales_to_hamiltonian()  — lists  → SparsePauliOp
    build_ising_hamiltonian()      — matrix → SparsePauliOp  (ZZ + Z)
    mvc_hamiltonian()              — adjacency → (J, h) for Vertex Cover
    weighted_maxcut_hamiltonian()  — adjacency → (J, h) for weighted MaxCut
"""

from qiskit.quantum_info import SparsePauliOp
import re


# ═══════════════════════════════════════════════════════════════════════════
#  Core builders
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


# ═══════════════════════════════════════════════════════════════════════════
#  Problem generators
# ═══════════════════════════════════════════════════════════════════════════


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
                J[i][j] += 0.75
                h[i] += 0.75
                h[j] += 0.75

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
