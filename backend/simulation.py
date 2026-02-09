from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
import numpy as np
from typing import List, Dict, Any

def build_circuit(num_qubits: int, gates: List[Dict[str, Any]]) -> QuantumCircuit:
    """
    Constructs a Qiskit QuantumCircuit from a list of gate dictionaries.
    
    Args:
        num_qubits (int): The number of qubits in the circuit.
        gates (List[Dict[str, Any]]): A list of dictionaries, each representing a gate.
            Each dictionary should contain 'name', 'qubits', and optional 'params'.
            
    Returns:
        QuantumCircuit: The constructed Qiskit quantum circuit object.
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
        elif name == "RX":
            theta = params[0] if params else np.pi/2
            qc.rx(theta, qubits[0])
        elif name == "RY":
            theta = params[0] if params else np.pi/2
            qc.ry(theta, qubits[0])
        elif name == "RZ":
            theta = params[0] if params else np.pi/2
            qc.rz(theta, qubits[0])
        elif name == "M":
             qc.measure_all()
        # Add more gates as needed

    return qc

def run_circuit(circuit: QuantumCircuit, shots: int = 1024):
    """
    Executes a QuantumCircuit on a local Aer simulator to get measurement counts.
    
    Args:
        circuit (QuantumCircuit): The circuit to execute.
        shots (int): Number of execution shots (times to run the circuit).
        
    Returns:
        dict: A dictionary containing 'counts' (measurement results) or 'error' message.
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
    Simulates the circuit to obtain the final statevector (before measurement).
    
    Args:
        circuit (QuantumCircuit): The circuit to simulate.
        
    Returns:
        dict: A dictionary containing 'statevector' (list of complex pairs) or 'error' message.
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

def get_bloch_image(circuit: QuantumCircuit):
    """
    Generates a Bloch sphere visualization for each qubit.
    Returns a list of base64 encoded images, one for each qubit.
    
    Args:
        circuit (QuantumCircuit): The circuit to simulate.
        
    Returns:
        dict: A dictionary containing 'bloch_images' (list of base64 strings) or 'error' message.
    """
    try:
        if not isinstance(circuit, QuantumCircuit):
             circuit = QuantumCircuit.from_qasm_str(circuit)

        simulator = AerSimulator(method='statevector')
        
        # Ensure no measurements for statevector simulation
        circuit_sv = circuit.copy()
        circuit_sv.remove_final_measurements() 
        circuit_sv.save_statevector()
        
        compiled_circuit = transpile(circuit_sv, simulator)
        result = simulator.run(compiled_circuit).result()
        statevector = result.get_statevector(circuit_sv)
        
        from qiskit.visualization import plot_bloch_vector
        from qiskit.quantum_info import partial_trace
        import io
        import base64
        import matplotlib.pyplot as plt
        import numpy as np
        
        num_qubits = circuit.num_qubits
        bloch_images = []
        
        # For each qubit, calculate its reduced density matrix and plot individually
        for i in range(num_qubits):
            # Trace out all qubits except i
            trace_indices = [j for j in range(num_qubits) if j != i]
            rho = partial_trace(statevector, trace_indices)
            
            # Calculate Pauli expectation values
            dm = rho.data
            x = np.real(dm[0, 1] + dm[1, 0])
            y = np.real(1j * (dm[0, 1] - dm[1, 0]))
            z = np.real(dm[0, 0] - dm[1, 1])
            
            # Create a separate figure for each qubit
            fig = plt.figure(figsize=(3, 3)) 
            ax = fig.add_subplot(111, projection='3d')
            plot_bloch_vector([x, y, z], ax=ax, title=f"Qubit {i}")
            
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            plt.close(fig)
            
            bloch_images.append(img_str)
        
        return {"bloch_images": bloch_images}
    except Exception as e:
        return {"error": str(e)}
