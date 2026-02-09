from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import CircuitRequest, ExecutionResult
from simulation import build_circuit, run_circuit, get_statevector
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
    return {"message": "Quantum Circuit Debugger API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/execute", response_model=ExecutionResult)
async def execute_circuit(request: CircuitRequest):
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
@app.post("/optimize")
async def optimize_circuit_endpoint(request: CircuitRequest):
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
@app.post("/export/latex")
async def export_latex(request: CircuitRequest):
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
