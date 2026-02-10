"""
algorithms — Modular quantum algorithm package.

Sub-modules:
    hamiltonian   – Shared Hamiltonian builders & problem generators.
    qaoa          – QAOA engine + class-based code generation.
    vqe           – VQE engine + class-based code generation.
    quantum_walk  – CTQW engine + class-based code generation.
"""

# Re-export every public symbol so callers can still do:
#     from algorithms import run_qaoa, run_vqe, ...
from algorithms.hamiltonian import (
    parse_hamiltonian,
    bases_scales_to_hamiltonian,
    build_ising_hamiltonian,
    mvc_hamiltonian,
    weighted_maxcut_hamiltonian,
)

from algorithms.qaoa import (
    build_qaoa_circuit,
    run_qaoa,
    generate_qaoa_code,
)

from algorithms.vqe import (
    build_vqe_ansatz,
    run_vqe,
    generate_vqe_code,
    generate_maxcut_code,
    maxcut_hamiltonian_from_adjacency,
    build_ansatz,
    run_optimization,
)

from algorithms.quantum_walk import (
    generate_graph,
    run_quantum_walk,
    generate_walk_code,
)
