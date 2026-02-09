from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
import numpy as np
from typing import List, Dict, Any

def build_circuit(num_qubits: int, gates: List[Dict[str, Any]]) -> QuantumCircuit:
    """
    Constructs a Qiskit QuantumCircuit from a list of gate dictionaries.
    """
    qc = QuantumCircuit(num_qubits)
    
    for gate in gates:
        name = gate.get("name").upper()
        qubits = gate.get("qubits")
        params = gate.get("params", []) or []
        
        if name == "H":
            qc.h(qubits[0])
        elif name == "X":
            qc.x(qubits[0])
        elif name == "Y":
            qc.y(qubits[0])
        elif name == "Z":
            qc.z(qubits[0])
        elif name == "CNOT" or name == "CX":
            if len(qubits) >= 2:
                qc.cx(qubits[0], qubits[1])
        elif name == "M":
             qc.measure_all()
        # Add more gates as needed

    return qc

def run_circuit(circuit: QuantumCircuit, shots: int = 1024):
    """
    Executes a QuantumCircuit on a local simulator.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
             circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator()
        # Ensure measurements for counts
        if not circuit.clbits:
            circuit.measure_all()
            
        compiled_circuit = transpile(circuit, simulator)
        result = simulator.run(compiled_circuit, shots=shots).result()
        counts = result.get_counts(circuit)
        return {"counts": counts}
    except Exception as e:
        return {"error": str(e)}

def get_statevector(circuit: QuantumCircuit):
    """
    Returns the statevector of the circuit.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
             circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator(method='statevector')
        
        # Remove measurements for statevector simulation if present to avoid collapse
        # But for strictly statevector simulator, we might just want to save statevector before measurement
        # For simplicity, let's assume the user sends a circuit without measurement for SV, or we handle it.
        # Ideally, we clone and remove measurements or just use save_statevector().
        
        circuit_sv = circuit.copy()
        circuit_sv.remove_final_measurements() 
        circuit_sv.save_statevector()
        
        compiled_circuit = transpile(circuit_sv, simulator)
        result = simulator.run(compiled_circuit).result()
        statevector = result.get_statevector(circuit_sv)
        
        # Format complex numbers for JSON
        sv_list = []
        for amp in np.asarray(statevector):
            sv_list.append([amp.real, amp.imag])
            
        return {"statevector": sv_list}
    except Exception as e:
        return {"error": str(e)}
