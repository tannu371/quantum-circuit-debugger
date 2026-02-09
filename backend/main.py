from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import CircuitRequest, ExecutionResult
from simulation import build_circuit, run_circuit, get_statevector, get_bloch_image
from optimization import optimize_circuit

app = FastAPI(title="Quantum Circuit Debugger API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    """
    Root endpoint to verify the API is running.
    """
    return {"message": "Quantum Circuit Debugger API is running"}

@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring purposes.
    """
    return {"status": "ok"}

@app.post("/execute", response_model=ExecutionResult)
async def execute_circuit(request: CircuitRequest):
    """
    Executes a quantum circuit simulation and returns counts and statevector.
    
    Args:
        request (CircuitRequest): The circuit definition and execution parameters.
        
    Returns:
        ExecutionResult: The simulation results including counts and statevector.
    """
    try:
        # Convert Pydantic models to list of dicts for builder
        gates_data = [gate.model_dump() for gate in request.gates]
        
        circuit = build_circuit(request.num_qubits, gates_data)
        
        # Run simulation to get counts
        result_counts = run_circuit(circuit, shots=request.shots)
        if "error" in result_counts:
             raise HTTPException(status_code=500, detail=result_counts["error"])
             
        # Run simulation to get statevector
        result_sv = get_statevector(circuit)
        if "error" in result_sv:
             # Statevector error shouldn't block counts return necessarily, but let's report it
             print(f"Statevector error: {result_sv['error']}")
        
        return ExecutionResult(
            counts=result_counts.get("counts", {}),
            statevector=result_sv.get("statevector"), 
            status="completed"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/optimize")
async def optimize_circuit_endpoint(request: CircuitRequest):
    """
    Optimizes the given quantum circuit and returns analysis metrics.
    
    Args:
        request (CircuitRequest): The circuit definition to optimize.
        
    Returns:
        dict: Optimization results including original/optimized depth and gate counts.
    """
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)
        
        result = optimize_circuit(circuit)
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
             
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/latex")
async def export_latex(request: CircuitRequest):
    """
    Generates LaTeX source code for the quantum circuit.
    
    Args:
        request (CircuitRequest): The circuit definition.
        
    Returns:
        dict: A dictionary containing the 'latex' source string.
    """
    try:
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)
        
        # specific to pylatexenc being installed
        latex_source = circuit.draw(output='latex_source')
        return {"latex": latex_source}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/image")
async def export_image(request: CircuitRequest):
    """
    Generates a PNG image of the quantum circuit.
    
    Args:
        request (CircuitRequest): The circuit definition.
        
    Returns:
        dict: A dictionary containing the 'image_base64' string.
    """
    try:
        import base64
        from io import BytesIO
        
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)
        
        # Draw to matplotlib figure
        fig = circuit.draw(output='mpl')
        
        # Save to buffer
        buf = BytesIO()
        fig.savefig(buf, format="png")
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode("utf-8")
        
        return {"image_base64": img_str}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/export/bloch")
async def export_bloch_sphere_endpoint(request: CircuitRequest):
    """
    Generates a Bloch sphere visualization of the final statevector.
    
    Args:
        request (CircuitRequest): The circuit definition.
        
    Returns:
        dict: A dictionary containing the 'image_base64' string.
    """
    try:
        # Convert Pydantic models to list of dicts for builder
        gates_data = [gate.model_dump() for gate in request.gates]
        circuit = build_circuit(request.num_qubits, gates_data)
        
        result = get_bloch_image(circuit)
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])
             
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
