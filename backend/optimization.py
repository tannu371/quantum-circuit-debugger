from qiskit import QuantumCircuit, transpile

def optimize_circuit(qasm_string: str):
    """
    Analyzes and optimizes the circuit.
    """
    try:
        circuit = QuantumCircuit.from_qasm_str(qasm_string)
        depth_original = circuit.depth()
        
        # Optimization level 3 (heavy optimization)
        optimized_circuit = transpile(circuit, optimization_level=3)
        depth_optimized = optimized_circuit.depth()
        
        return {
            "original_depth": depth_original,
            "optimized_depth": depth_optimized,
            "optimized_qasm": optimized_circuit.qasm(),
            "improvement_msg": f"Reduced depth from {depth_original} to {depth_optimized}"
        }
    except Exception as e:
        return {"error": str(e)}
