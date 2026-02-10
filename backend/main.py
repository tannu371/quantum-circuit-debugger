"""
main.py — FastAPI application for the Quantum Circuit Debugger.

Exposes RESTful endpoints for:
  • Circuit execution (measurement counts + statevector).
  • Circuit optimisation via Qiskit's transpiler.
  • Export to LaTeX, PNG image, and Bloch sphere visualisation.
  • Advanced algorithms (VQE / QAOA).
  • Quantum Fourier Transform (QFT) construction and simulation.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    CircuitRequest,
    ExecutionResult,
    AlgorithmRequest,
    AlgorithmResponse,
    VQERequest,
    VQEResponse,
    QFTRequest,
    QFTResponse,
    QAOARequest,
    QAOAResponse,
    QuantumWalkRequest,
    QuantumWalkResponse,
)
from simulation import (
    build_circuit,
    run_circuit,
    get_statevector,
    get_bloch_image,
    build_qft_circuit,
)
from optimization import optimize_circuit
from algorithms import (
    run_optimization, run_vqe, generate_vqe_code,
    generate_maxcut_code, maxcut_hamiltonian_from_adjacency,
    run_qaoa, generate_qaoa_code,
    run_quantum_walk, generate_walk_code, generate_graph,
)

import traceback

# ---------------------------------------------------------------------------
# Application setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Quantum Circuit Debugger API",
    description="Backend API for building, simulating, optimising, and exporting quantum circuits.",
    version="2.0.0",
)

# Allow cross-origin requests from the Next.js frontend during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health / Root
# ---------------------------------------------------------------------------


@app.get("/")
def read_root():
    """Root endpoint — verify the API is running."""
    return {"message": "Quantum Circuit Debugger API is running"}


@app.get("/health")
def health_check():
    """Lightweight health-check for monitoring and load-balancer probes."""
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Circuit execution
# ---------------------------------------------------------------------------


@app.post("/execute", response_model=ExecutionResult)
async def execute_circuit_endpoint(request: CircuitRequest):
    """
    Simulate a quantum circuit and return measurement counts + statevector.

    The circuit is built from the list of gates, executed on the Aer
    simulator for the requested number of shots, and the statevector is
    extracted from a separate measurement-free run.
    """
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)

        # Measurement counts
        result_counts = run_circuit(circuit, shots=request.shots)
        if "error" in result_counts:
            raise HTTPException(status_code=500, detail=result_counts["error"])

        # Statevector (best-effort — does not block counts)
        result_sv = get_statevector(circuit)
        if "error" in result_sv:
            print(f"[WARN] Statevector error: {result_sv['error']}")

        return ExecutionResult(
            counts=result_counts.get("counts", {}),
            statevector=result_sv.get("statevector"),
            status="completed",
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Circuit optimisation
# ---------------------------------------------------------------------------


@app.post("/optimize")
async def optimize_circuit_endpoint(request: CircuitRequest):
    """
    Optimise the circuit using Qiskit's transpiler (level 3) and return
    a comparison of original vs. optimised depth and gate counts.
    """
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)

        result = optimize_circuit(circuit)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Export endpoints
# ---------------------------------------------------------------------------


@app.post("/export/latex")
async def export_latex(request: CircuitRequest):
    """Generate LaTeX source code for the quantum circuit diagram."""
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)
        latex_source = circuit.draw(output="latex_source")
        return {"latex": latex_source}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/image")
async def export_image(request: CircuitRequest):
    """Render the circuit as a PNG image and return it Base64-encoded."""
    try:
        import base64
        from io import BytesIO

        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)

        fig = circuit.draw(output="mpl")
        buf = BytesIO()
        fig.savefig(buf, format="png")
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode("utf-8")

        return {"image_base64": img_str}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/bloch")
async def export_bloch_sphere_endpoint(request: CircuitRequest):
    """Generate per-qubit Bloch sphere images (Base64 PNGs)."""
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)

        result = get_bloch_image(circuit)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])

        return result
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Advanced algorithms (VQE / QAOA)
# ---------------------------------------------------------------------------


@app.post("/run-algorithm", response_model=AlgorithmResponse)
async def run_algorithm_endpoint(request: AlgorithmRequest):
    """
    Run a variational quantum algorithm (VQE or QAOA).

    The user's circuit acts as the ansatz; rotation gates become tuneable
    parameters that the classical optimiser adjusts to minimise the
    Hamiltonian expectation value.
    """
    try:
        result = run_optimization(
            circuit_data=request.circuit,
            hamiltonian_str=request.hamiltonian,
            max_iter=request.max_iter,
            method=request.optimizer,
        )

        if result.get("status") == "failed":
            raise HTTPException(status_code=500, detail=result.get("error"))

        return AlgorithmResponse(
            status="completed",
            optimal_energy=result.get("optimal_energy"),
            optimal_params=result.get("optimal_params"),
            history=result.get("history"),
            message=result.get("message"),
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Quantum Fourier Transform (QFT)
# ---------------------------------------------------------------------------


@app.post("/qft", response_model=QFTResponse)
async def run_qft_endpoint(request: QFTRequest):
    """
    Build and simulate a Quantum Fourier Transform circuit.

    Optionally initialise the register to a specific bitstring before
    applying QFT (or inverse QFT).  Returns measurement counts,
    statevector, circuit depth, and total gate count.
    """
    try:
        # Build the QFT circuit
        qft_circuit = build_qft_circuit(request.num_qubits, inverse=request.inverse)

        # Optionally prepend X gates to set the initial state
        if request.initial_state:
            from qiskit import QuantumCircuit

            init_qc = QuantumCircuit(request.num_qubits)
            for i, bit in enumerate(reversed(request.initial_state)):
                if bit == "1":
                    init_qc.x(i)
            full_circuit = init_qc.compose(qft_circuit)
        else:
            full_circuit = qft_circuit

        # Gather metrics
        depth = full_circuit.depth()
        num_gates = sum(full_circuit.count_ops().values())

        # Simulate
        result_counts = run_circuit(full_circuit, shots=request.shots)
        result_sv = get_statevector(full_circuit)

        return QFTResponse(
            counts=result_counts.get("counts"),
            statevector=result_sv.get("statevector"),
            circuit_depth=depth,
            num_gates=num_gates,
            status="completed",
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
#  QAOA endpoint
# ---------------------------------------------------------------------------


@app.post("/qaoa", response_model=QAOAResponse)
async def run_qaoa_endpoint(request: QAOARequest):
    """
    Run a full QAOA optimization for an Ising-model cost Hamiltonian.

    Accepts an interaction matrix J_{ij}, number of QAOA layers, and
    optimizer settings.  Returns optimal parameters, measurement counts,
    statevector probabilities, convergence history, and auto-generated
    code for Qiskit, PennyLane, Cirq, Q#, and OpenQASM.
    """
    try:
        result = run_qaoa(
            num_qubits=request.num_qubits,
            interaction_matrix=request.interaction_matrix,
            p_layers=request.p_layers,
            max_iter=request.max_iter,
            method=request.optimizer,
            shots=request.shots,
            linear_terms=request.linear_terms,
        )

        # Generate code for all frameworks
        code = {}
        for fw in ("qiskit", "pennylane", "cirq", "qsharp", "qasm"):
            code[fw] = generate_qaoa_code(
                num_qubits=request.num_qubits,
                interaction_matrix=request.interaction_matrix,
                opt_gammas=result["optimal_gammas"],
                opt_betas=result["optimal_betas"],
                framework=fw,
                linear_terms=request.linear_terms,
            )

        return QAOAResponse(
            status="completed",
            optimal_energy=result["optimal_energy"],
            optimal_gammas=result["optimal_gammas"],
            optimal_betas=result["optimal_betas"],
            optimal_params=result["optimal_params"],
            history=result["history"],
            counts=result["counts"],
            probabilities=result["probabilities"],
            most_likely_state=result["most_likely_state"],
            p_layers=result["p_layers"],
            code=code,
            message=result.get("message"),
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
#  VQE (standalone) endpoint
# ---------------------------------------------------------------------------


@app.post("/vqe", response_model=VQEResponse)
async def run_vqe_endpoint(request: VQERequest):
    """
    Run a full standalone VQE optimization.

    Accepts Hamiltonian bases/scales, builds an RY ansatz internally,
    optimises parameters, and returns measurement counts, convergence
    history, and auto-generated code for all five frameworks.
    """
    try:
        # Determine bases/scales from adjacency matrix or direct input
        is_maxcut = (
            request.problem_type == "maxcut" and request.adjacency_matrix is not None
        )

        if is_maxcut:
            h_bases, h_scales = maxcut_hamiltonian_from_adjacency(
                request.adjacency_matrix,
                invert=request.invert_adjacency,
            )
            # Auto-derive num_qubits from adjacency matrix dimensions
            n_qubits = len(request.adjacency_matrix)
        else:
            h_bases = request.hamiltonian_bases or []
            h_scales = request.hamiltonian_scales or []
            n_qubits = request.num_qubits

        if not h_bases:
            raise HTTPException(
                status_code=400,
                detail="Provide hamiltonian_bases/scales or adjacency_matrix with problem_type='maxcut'.",
            )

        result = run_vqe(
            num_qubits=n_qubits,
            hamiltonian_bases=h_bases,
            hamiltonian_scales=h_scales,
            ansatz_depth=request.ansatz_depth,
            max_iter=request.max_iter,
            method=request.optimizer,
            shots=request.shots,
        )

        # Generate code for all frameworks
        code = {}
        for fw in ("qiskit", "pennylane", "cirq", "qsharp", "qasm"):
            if is_maxcut:
                code[fw] = generate_maxcut_code(
                    adjacency_matrix=request.adjacency_matrix,
                    opt_params=result["optimal_params"],
                    invert_adjacency=request.invert_adjacency,
                    framework=fw,
                )
            else:
                code[fw] = generate_vqe_code(
                    num_qubits=n_qubits,
                    hamiltonian_bases=h_bases,
                    hamiltonian_scales=h_scales,
                    opt_params=result["optimal_params"],
                    ansatz_depth=request.ansatz_depth,
                    framework=fw,
                )

        return VQEResponse(
            status="completed",
            optimal_energy=result["optimal_energy"],
            optimal_params=result["optimal_params"],
            history=result["history"],
            counts=result["counts"],
            probabilities=result["probabilities"],
            most_likely_state=result["most_likely_state"],
            ansatz_depth=result["ansatz_depth"],
            code=code,
            hamiltonian_bases=h_bases,
            hamiltonian_scales=h_scales,
            message=result.get("message"),
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
#  Quantum Walk endpoint
# ---------------------------------------------------------------------------


@app.post("/quantum-walk", response_model=QuantumWalkResponse)
async def run_quantum_walk_endpoint(request: QuantumWalkRequest):
    """
    Run a Continuous-Time Quantum Walk (CTQW) on a graph.

    Provide ``topology`` + ``num_vertices`` to auto-generate a graph, or
    supply a custom ``adjacency_matrix``.
    """
    try:
        # Build adjacency matrix
        if request.adjacency_matrix:
            adj = request.adjacency_matrix
        elif request.topology:
            adj = generate_graph(request.topology, request.num_vertices)
        else:
            adj = generate_graph("cycle", request.num_vertices)

        result = run_quantum_walk(
            adjacency_matrix=adj,
            initial_vertex=request.initial_vertex,
            num_steps=request.num_steps,
            dt=request.dt,
            shots=request.shots,
        )

        # Generate code for all frameworks
        code = {}
        for fw in ("qiskit", "pennylane", "cirq", "qsharp", "qasm"):
            code[fw] = generate_walk_code(
                adjacency_matrix=adj,
                initial_vertex=request.initial_vertex,
                num_steps=request.num_steps,
                dt=request.dt,
                framework=fw,
            )

        return QuantumWalkResponse(
            status="completed",
            probability_evolution=result["probability_evolution"],
            final_counts=result["final_counts"],
            most_likely_vertex=result["most_likely_vertex"],
            most_likely_state=result["most_likely_state"],
            num_vertices=result["num_vertices"],
            num_qubits=result["num_qubits"],
            num_steps=result["num_steps"],
            dt=result["dt"],
            initial_vertex=result["initial_vertex"],
            code=code,
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
