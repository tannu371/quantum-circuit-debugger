from qiskit import QuantumCircuit, transpile
import qiskit.qasm2

def optimize_circuit(circuit: QuantumCircuit):
    """
    Analyzes and optimizes the quantum circuit using Qiskit's transpiler.
    
    This function applies high-level optimization (level 3) to reduce circuit depth
    and gate count.
    
    Args:
        circuit (QuantumCircuit): The circuit to optimize.
        
    Returns:
        dict: A dictionary containing comparison metrics (original/optimized depth, ops)
              and the optimized OpenQASM code.
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
            "optimized_qasm": qiskit.qasm2.dumps(optimized_circuit),
            "improvement_msg": f"Reduced depth from {depth_original} to {depth_optimized}. Gates: {sum(count_original.values())} -> {sum(count_optimized.values())}"
        }
    except Exception as e:
        return {"error": str(e)}
