# Quantum Circuit Debugger - Project Documentation

## Project Overview
This project is a web-based **Quantum Circuit Debugger & Visualizer** built to provide an interactive way to design, simulating, optimize, and debug quantum circuits. It integrates a **Next.js frontend** with a **FastAPI backend** powered by **Qiskit**.

## Features Implemented

### 1. Frontend (Next.js & React)
- **Interactive Circuit Builder**:
  - Drag-and-drop interface using `@dnd-kit`.
  - Supports single-qubit gates (X, Y, Z, H, S, T) and multi-qubit gates (CNOT, SWAP).
  - Undo/Redo functionality for circuit modifications.
  - Dynamically resizable grid (default 3 qubits, 8 steps).
  
- **Circuit Management**:
  - **Save/Load**: Save circuits to JSON files and reload them later.
  - **Clear Circuit**: Reset the board.

- **Simulation & Visualization**:
  - **Run Button**: Executes the circuit on the backend simulator.
  - **Results Display**: Shows measurement probabilities/counts using Recharts bar charts.
  - **Logs Panel**: Displays system status and execution logs.

- **Optimization**:
  - **Optimize Button**: Sends the circuit to the backend for transpilation (optimization level 3).
  - **Optimization Report**: Displays original vs. optimized depth, gate counts, and the optimized OpenQASM code.

- **Export Capabilities**:
  - **Python (Qiskit)**: Generates executable Python code for the circuit.
  - **OpenQASM**: Generates standard OpenQASM 2.0 code.
  - **LaTeX**: Generates LaTeX source code for circuit diagrams.
  - **Image (PNG)**: Downloads a high-quality image of the circuit diagram.

### 2. Backend (FastAPI & Python)
- **API Endpoints**:
  - `POST /execute`: Runs a quantum circuit simulation (1024 shots) and returns counts/probabilities.
  - `POST /optimize`: Optimizes the circuit using Qiskit's transpiler and returns metrics.
  - `POST /export/latex`: Generates LaTeX source code for circuit visualization.
  - `POST /export/image`: Generates a base64-encoded PNG image of the circuit using Matplotlib.

- **Core Logic**:
  - **Simulation**: Uses `qiskit-aer` for high-performance simulation.
  - **Transpilation**: Uses `qiskit.transpile` for transpilation.
  - **Visualization**: Uses `circuit.draw()` with 'mpl' and 'latex_source' backends.

### 3. DevOps & Deployment
- **Dockerization**:
  - `Dockerfile` for Backend (Python 3.9 slim).
  - `Dockerfile` for Frontend (Node 18 Alpine).
- **Orchestration**:
  - `docker-compose.yml` to run both services with a single command.

## Technology Stack
- **Frontend**: Next.js, TypeScript, TailwindCSS, Lucide React, Recharts, Axios.
- **Backend**: Python, FastAPI, Pydantic, Uvicorn.
- **Quantum SDK**: Qiskit, Qiskit Aer.
- **Tools**: Docker, Docker Compose.

## How to Run

### Option 1: Docker (Recommended)
Run the entire application stack:
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

### Option 2: Manual Setup

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## API Reference
The backend exposes interactive documentation at http://localhost:8000/docs.

## Future Roadmap
- Integration with real quantum hardware (IBM Quantum).
- User authentication and cloud storage for circuits.
- Advanced noise models and error mitigation.
- Step-by-step statevector debugging (visualization at each gate).
