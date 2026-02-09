from qiskit import QuantumCircuit, transpile

def optimize_circuit(circuit: QuantumCircuit):
    """
    Analyzes and optimizes the circuit.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
             circuit = QuantumCircuit.from_qasm_str(circuit)

        depth_original = circuit.depth()
        count_original = circuit.count_ops()
        
        # Optimization level 3 (heavy optimization)
        # In a real tool, we might use specific passes like CommutativeCancellation, etc.
        optimized_circuit = transpile(circuit, optimization_level=3)
        depth_optimized = optimized_circuit.depth()
        count_optimized = optimized_circuit.count_ops()
        
        return {
            "original_depth": depth_original,
            "optimized_depth": depth_optimized,
            "original_ops": count_original,
            "optimized_ops": count_optimized,
            "optimized_qasm": optimized_circuit.qasm(),
            "improvement_msg": f"Reduced depth from {depth_original} to {depth_optimized}. Gates: {sum(count_original.values())} -> {sum(count_optimized.values())}"
        }
    except Exception as e:
        return {"error": str(e)}
