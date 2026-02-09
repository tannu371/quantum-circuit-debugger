from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
import numpy as np

def run_circuit(qasm_string: str, shots: int = 1024):
    """
    Executes a QASM string on a local simulator.
    """
    try:
        circuit = QuantumCircuit.from_qasm_str(qasm_string)
        simulator = AerSimulator()
        compiled_circuit = transpile(circuit, simulator)
        result = simulator.run(compiled_circuit, shots=shots).result()
        counts = result.get_counts(circuit)
        return {"counts": counts}
    except Exception as e:
        return {"error": str(e)}

def get_statevector(qasm_string: str):
    """
    Returns the statevector of the circuit.
    """
    try:
        circuit = QuantumCircuit.from_qasm_str(qasm_string)
        simulator = AerSimulator(method='statevector')
        circuit.save_statevector()
        compiled_circuit = transpile(circuit, simulator)
        result = simulator.run(compiled_circuit).result()
        statevector = result.get_statevector(circuit)
        return {"statevector": np.asarray(statevector).tolist()}
    except Exception as e:
        return {"error": str(e)}
