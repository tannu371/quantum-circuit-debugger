"""
models.py — Pydantic request / response models for the Quantum Circuit Debugger API.

These models enforce strict input validation and provide clear documentation
of the JSON contract between the frontend and backend.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict


# ---------------------------------------------------------------------------
# Gate & Circuit models
# ---------------------------------------------------------------------------


class QuantumGate(BaseModel):
    """
    A single quantum gate in a circuit.

    Attributes:
        name:   Gate identifier (case-insensitive). Supported values include
                ``H``, ``X``, ``Y``, ``Z``, ``S``, ``T``,
                ``RX``, ``RY``, ``RZ``,
                ``CNOT``/``CX``, ``CY``, ``CZ``, ``CH``, ``SWAP``,
                ``CRX``, ``CRY``, ``CRZ``, ``CP``,
                ``CCX``/``TOFFOLI``, ``CSWAP``/``FREDKIN``, ``M``.
        qubits: Ordered list of qubit indices the gate acts on.
                Length must match the gate arity (1, 2, or 3).
        params: Optional rotation / phase angles (radians) for parameterised
                gates such as ``RX``, ``CRZ``, ``CP``, etc.
    """

    name: str
    qubits: List[int]
    params: Optional[List[float]] = None


class CircuitRequest(BaseModel):
    """
    Request body for endpoints that accept a circuit definition.

    Attributes:
        gates:      Ordered list of gates defining the circuit.
        num_qubits: Total number of qubits in the register.
        shots:      Number of measurement repetitions (default 1024).
    """

    gates: List[QuantumGate]
    num_qubits: int = Field(..., ge=1, description="Number of qubits (≥ 1).")
    shots: int = Field(1024, ge=1, description="Measurement shots (≥ 1).")


class ExecutionResult(BaseModel):
    """
    Response body for circuit execution results.

    Attributes:
        counts:      Mapping of basis-state bitstrings to measurement counts.
        statevector: Final statevector as a list of ``[real, imag]`` pairs.
                     ``None`` if statevector retrieval failed.
        status:      ``"completed"`` or ``"failed"``.
        error:       Human-readable error message (only on failure).
    """

    counts: Dict[str, int]
    statevector: Optional[List[List[float]]] = None
    status: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Algorithm (VQE / QAOA) models
# ---------------------------------------------------------------------------


class AlgorithmRequest(BaseModel):
    """
    Request body for running a variational quantum algorithm.

    Attributes:
        circuit:     The ansatz circuit (with rotation gates as parameters).
        hamiltonian: Hamiltonian expression, e.g. ``"Z0 Z1 + 0.5 * X0"``.
        algorithm:   Algorithm type — ``"VQE"`` or ``"QAOA"``.
        max_iter:    Maximum classical optimisation iterations.
        optimizer:   SciPy optimiser name (``COBYLA``, ``L-BFGS-B``, ``SLSQP``).
    """

    circuit: CircuitRequest
    hamiltonian: str
    algorithm: str = "VQE"
    max_iter: int = Field(50, ge=1)
    optimizer: str = "COBYLA"


class AlgorithmResponse(BaseModel):
    """
    Response body for algorithm execution.

    Attributes:
        status:         ``"completed"`` or ``"failed"``.
        optimal_energy: Lowest energy found by the optimiser.
        optimal_params: Optimal parameter vector (radians).
        history:        Energy value at each iteration (for convergence plots).
        message:        Optimiser convergence message.
        error:          Error description (only on failure).
    """

    status: str
    optimal_energy: Optional[float] = None
    optimal_params: Optional[List[float]] = None
    history: Optional[List[float]] = None
    message: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# VQE (standalone) models
# ---------------------------------------------------------------------------


class VQERequest(BaseModel):
    """
    Request body for the standalone VQE endpoint.

    Accepts Hamiltonian in basis-string format (e.g. ``["ZZ", "ZI"]`` with
    corresponding ``scales``).  Builds its own RY ansatz internally.

    Alternatively, supply ``adjacency_matrix`` + ``problem_type="maxcut"``
    and the backend will auto-generate the Hamiltonian bases/scales.
    """

    num_qubits: int = Field(..., ge=2, description="Number of qubits (≥ 2).")
    hamiltonian_bases: Optional[List[str]] = Field(
        None, description='Pauli basis strings, e.g. ["ZZ","ZI"].'
    )
    hamiltonian_scales: Optional[List[float]] = Field(
        None, description="Scale factor for each basis term."
    )
    adjacency_matrix: Optional[List[List[float]]] = Field(
        None,
        description="Adjacency matrix for graph problems (MaxCut clustering).",
    )
    problem_type: Optional[str] = Field(
        None,
        description='Problem type: "maxcut" or None for custom Hamiltonian.',
    )
    invert_adjacency: bool = Field(
        True,
        description="If True, use distance matrix (1 − A) for MaxCut Hamiltonian.",
    )
    ansatz_depth: int = Field(1, ge=1, le=10, description="Ansatz layer depth (1–10).")
    max_iter: int = Field(100, ge=1, le=1000)
    optimizer: str = "COBYLA"
    shots: int = Field(1024, ge=1)


class VQEResponse(BaseModel):
    """
    Response body for standalone VQE execution.

    Includes measurement counts, code export, and optimal state information.
    """

    status: str
    optimal_energy: Optional[float] = None
    optimal_params: Optional[List[float]] = None
    history: Optional[List[float]] = None
    counts: Optional[Dict[str, int]] = None
    probabilities: Optional[List[float]] = None
    most_likely_state: Optional[str] = None
    ansatz_depth: Optional[int] = None
    code: Optional[Dict[str, str]] = None
    circuit_diagram: Optional[str] = None
    hamiltonian_bases: Optional[List[str]] = None
    hamiltonian_scales: Optional[List[float]] = None
    message: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# QFT models
# ---------------------------------------------------------------------------


class QFTRequest(BaseModel):
    """
    Request body for the QFT endpoint.

    Attributes:
        num_qubits:    Number of qubits for the QFT circuit.
        initial_state: Optional bitstring to initialise the register
                       (e.g. ``"101"``). Defaults to ``|0…0⟩``.
        inverse:       If ``True``, apply the inverse QFT (QFT†).
        shots:         Measurement shots (default 1024).
    """

    num_qubits: int = Field(..., ge=1)
    initial_state: Optional[str] = None
    inverse: bool = False
    shots: int = Field(1024, ge=1)


class QFTResponse(BaseModel):
    """
    Response body for QFT execution.

    Attributes:
        counts:      Measurement distribution after QFT.
        statevector: Final statevector as ``[real, imag]`` pairs.
        circuit_depth: Depth of the constructed QFT circuit.
        num_gates:   Total gate count in the QFT circuit.
        status:      ``"completed"`` or ``"failed"``.
        error:       Error description (only on failure).
    """

    counts: Optional[Dict[str, int]] = None
    statevector: Optional[List[List[float]]] = None
    circuit_depth: Optional[int] = None
    num_gates: Optional[int] = None
    status: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# QAOA models
# ---------------------------------------------------------------------------


class QAOARequest(BaseModel):
    """
    Request body for the QAOA endpoint.

    Attributes:
        num_qubits:         Number of qubits.
        interaction_matrix: Upper-triangular coupling matrix J_{ij} for
                            the Ising cost Hamiltonian H_c = Σ J_{ij} Z_i Z_j.
        p_layers:           Number of QAOA layers (default 1).
        max_iter:           Max classical optimizer iterations (default 100).
        optimizer:          SciPy optimizer name (default ``COBYLA``).
        shots:              Measurement shots for final circuit (default 1024).
    """

    num_qubits: int = Field(..., ge=2, description="Number of qubits (≥ 2).")
    interaction_matrix: List[List[float]]
    linear_terms: Optional[List[float]] = Field(
        None,
        description="Single-qubit Z field strengths h_i.  H += Σ h_i Z_i.",
    )
    p_layers: int = Field(1, ge=1, le=10, description="QAOA layers p (1–10).")
    max_iter: int = Field(100, ge=1, le=1000)
    optimizer: str = "COBYLA"
    shots: int = Field(1024, ge=1)


class QAOAResponse(BaseModel):
    """
    Response body for QAOA execution.

    Attributes:
        status:            ``"completed"`` or ``"failed"``.
        optimal_energy:    Minimum expectation value found.
        optimal_gammas:    Optimised γ (cost) angles per layer.
        optimal_betas:     Optimised β (mixer) angles per layer.
        history:           Energy at each optimizer iteration.
        counts:            Measurement distribution from the optimal circuit.
        probabilities:     Statevector probability amplitudes.
        most_likely_state: Most probable measurement outcome.
        p_layers:          Number of QAOA layers used.
        code:              Dict of generated code: ``{qiskit, pennylane, cirq, qsharp, qasm}``.
        error:             Error description (only on failure).
    """

    status: str
    optimal_energy: Optional[float] = None
    optimal_gammas: Optional[List[float]] = None
    optimal_betas: Optional[List[float]] = None
    optimal_params: Optional[List[float]] = None
    history: Optional[List[float]] = None
    counts: Optional[Dict[str, int]] = None
    probabilities: Optional[List[float]] = None
    most_likely_state: Optional[str] = None
    p_layers: Optional[int] = None
    code: Optional[Dict[str, str]] = None
    circuit_diagram: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Quantum Walk models
# ---------------------------------------------------------------------------


class QuantumWalkRequest(BaseModel):
    """
    Request body for the quantum walk endpoint.

    Provide either ``adjacency_matrix`` directly or ``topology`` +
    ``num_vertices`` to auto-generate a standard graph.
    """

    topology: Optional[str] = Field(
        None,
        description="Graph topology: cycle, path, complete, star, grid.",
    )
    num_vertices: int = Field(4, ge=2, le=16, description="Number of graph vertices.")
    adjacency_matrix: Optional[List[List[float]]] = None
    initial_vertex: int = Field(0, ge=0, description="Starting vertex (0-indexed).")
    num_steps: int = Field(10, ge=1, le=50, description="Time snapshots.")
    dt: float = Field(0.5, gt=0, description="Time step size.")
    shots: int = Field(1024, ge=1)


class QuantumWalkResponse(BaseModel):
    """Response body for quantum walk execution."""

    status: str
    probability_evolution: Optional[List[dict]] = None
    final_counts: Optional[Dict[str, int]] = None
    most_likely_vertex: Optional[int] = None
    most_likely_state: Optional[str] = None
    num_vertices: Optional[int] = None
    num_qubits: Optional[int] = None
    num_steps: Optional[int] = None
    dt: Optional[float] = None
    initial_vertex: Optional[int] = None
    code: Optional[Dict[str, str]] = None
    error: Optional[str] = None
