from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class QuantumGate(BaseModel):
    """
    Represents a single quantum gate in a circuit.
    
    Attributes:
        name (str): The name/type of the gate (e.g., 'H', 'CNOT').
        qubits (List[int]): List of qubit indices this gate acts on.
        params (Optional[List[float]]): Optional parameters for parameterized gates (e.g., rotation angles).
    """
    name: str
    qubits: List[int]
    params: Optional[List[float]] = None

class CircuitRequest(BaseModel):
    """
    Request model for executing or processing a quantum circuit.
    
    Attributes:
        gates (List[QuantumGate]): Ordered list of gates defining the circuit.
        num_qubits (int): Total number of qubits in the circuit.
        shots (int): Number of times to execute the circuit (for sampling).
    """
    gates: List[QuantumGate]
    num_qubits: int
    shots: int = 1024

class ExecutionResult(BaseModel):
    """
    Response model containing simulation results.
    
    Attributes:
        counts (Dict[str, int]): Dictionary mapping basis states to their measurement counts.
        statevector (Optional[List[complex]]): The final statevector of the quantum system (complex amplitudes).
        status (str): status of the execution (e.g., 'completed', 'failed').
        error (Optional[str]): Error message if execution failed.
    """
    counts: Dict[str, int]
    statevector: Optional[List[List[float]]] = None
    status: str
    error: Optional[str] = None
