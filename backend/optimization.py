"""
optimization.py — Circuit analysis and transpiler-based optimisation.

Uses Qiskit's multi-pass transpiler at optimisation level 3 to reduce
circuit depth and gate count, then re-exports the optimised circuit as
OpenQASM 2.0.
"""

from qiskit import QuantumCircuit, transpile
import qiskit.qasm2


def optimize_circuit(circuit: QuantumCircuit) -> dict:
    """
    Analyse and optimise a quantum circuit via Qiskit's transpiler.

    The ``transpile`` function is invoked with ``optimization_level=3``,
    which enables the most aggressive pass sequence including:
      - Commutation-aware gate cancellation.
      - Two-qubit gate synthesis (KAK decomposition).
      - Layout and routing optimisations.

    Args:
        circuit: The circuit to optimise. May also be an OpenQASM string,
                 which will be parsed automatically.

    Returns:
        A dictionary containing:
          - ``original_depth``  / ``optimized_depth``: Circuit depths.
          - ``original_ops``    / ``optimized_ops``:   Gate count dicts.
          - ``optimized_qasm``: OpenQASM 2.0 source of the optimised circuit.
          - ``improvement_msg``: Human-readable comparison summary.
          - ``error`` (only on failure): Error description.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
            circuit = QuantumCircuit.from_qasm_str(circuit)

        depth_original = circuit.depth()
        count_original = circuit.count_ops()

        # Level 3: heavy optimisation (KAK, commutative cancellation, …)
        optimized = transpile(circuit, optimization_level=3)
        depth_optimized = optimized.depth()
        count_optimized = optimized.count_ops()

        total_orig = sum(count_original.values())
        total_opt = sum(count_optimized.values())

        return {
            "original_depth": depth_original,
            "optimized_depth": depth_optimized,
            "original_ops": count_original,
            "optimized_ops": count_optimized,
            "optimized_qasm": qiskit.qasm2.dumps(optimized),
            "improvement_msg": (
                f"Reduced depth from {depth_original} to {depth_optimized}. "
                f"Gates: {total_orig} → {total_opt}"
            ),
        }
    except Exception as e:
        return {"error": str(e)}
