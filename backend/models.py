from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class QuantumGate(BaseModel):
    name: str
    qubits: List[int]
    params: Optional[List[float]] = None

class CircuitRequest(BaseModel):
    gates: List[QuantumGate]
    num_qubits: int
    shots: int = 1024

class ExecutionResult(BaseModel):
    counts: Dict[str, int]
    statevector: Optional[List[complex]] = None
    status: str
    error: Optional[str] = None
