# Quantum Circuit Debugger — Project Documentation

## Project Overview

A web-based **Quantum Circuit Debugger & Visualiser** that provides an interactive way to design, simulate, optimise, and debug quantum circuits. Built with a **Next.js frontend** and a **FastAPI backend** powered by **Qiskit**. Includes integrated variational algorithms (VQE, QAOA), continuous-time quantum walks, and MaxCut graph clustering with visualization.

---

## Features Implemented

### 1. Frontend (Next.js & React)

- **Interactive Circuit Builder**:
  - Drag-and-drop interface using `@dnd-kit`.
  - Organised gate palette with five sections: Basic, Rotation, Controlled, Multi-Qubit, and Utility.
  - Supports 20+ gate types including all standard controlled operations.
  - Double-click rotation / controlled-rotation gates to edit angles (radians or π multiples).
  - Undo / Redo with full history support.
  - Dynamically resizable grid (default 3 qubits, 10 steps).

- **Circuit Management**:
  - **Save / Load** — export circuits to JSON and reload them.
  - **Clear Circuit** — reset the board.

- **Simulation & Visualisation**:
  - **Run** — execute the circuit on the backend Aer simulator.
  - **Results Display** — bar chart of measurement probabilities (Recharts).
  - **Live Bloch Sphere** — per-qubit Bloch sphere updates automatically as you build.
  - **Logs Panel** — system status and execution messages.

- **Optimisation**:
  - **Optimise** — sends the circuit for transpilation (level 3).
  - **Report** — original vs. optimised depth and gate counts, plus OpenQASM output.

- **Advanced Algorithms (Algorithm Modal)**:
  - **QAOA** — configure Hamiltonian (adjacency matrix + linear terms), p-layers, optimizer.
    - Built-in presets: MaxCut K₄, Ising Chain, Vertex Cover (Triangle & Path), custom.
    - Results: convergence plot, optimal γ/β parameters, solution state.
    - Graph visualization with cluster coloring for MaxCut solutions.
  - **VQE** — two modes:
    - **Hamiltonian mode** — specify Pauli basis strings and coefficients directly.
    - **MaxCut Graph mode** — input adjacency matrix, auto-derive Z⊗Z Hamiltonian.
      - Presets: Example (4v), Triangle (3v), Path (4v), Complete K₄, Custom.
      - Optional adjacency inversion (1−A) for similarity matrices.
      - Graph visualization showing cluster partitions (Cluster A / B).
      - Derived Hamiltonian terms displayed in results.
      - Class-based code generation (`QuantumMaxCutClustering`).
  - **Quantum Walk** — continuous-time quantum walk (CTQW).
    - Topologies: Cycle, Path, Complete, Star, Custom adjacency.
    - Time-evolution probability charts and most-likely vertex.

- **Export Capabilities** (5 frameworks + image/LaTeX):
  - **Qiskit** (Python) — fully executable circuit code.
  - **OpenQASM 2.0** — standard quantum assembly.
  - **PennyLane** (Python) — differentiable quantum circuit.
  - **Cirq** (Python) — Google's quantum framework.
  - **Q#** (Microsoft) — .NET quantum programs.
  - **LaTeX** — circuit diagram source code.
  - **Image (PNG)** — high-quality circuit diagram download.

---

### 2. Backend (FastAPI & Python)

- **API Endpoints**:

  | Endpoint | Description |
  |----------|-------------|
  | `GET /` | Root health message |
  | `GET /health` | Health check |
  | `POST /execute` | Simulate circuit → counts + statevector |
  | `POST /optimize` | Transpile and report depth/gate-count improvements |
  | `POST /export/latex` | Generate LaTeX source |
  | `POST /export/image` | Generate Base64 PNG |
  | `POST /export/bloch` | Per-qubit Bloch sphere images |
  | `POST /qaoa` | QAOA variational algorithm |
  | `POST /vqe` | VQE (Hamiltonian or MaxCut graph mode) |
  | `POST /quantum-walk` | Continuous-time quantum walk |
  | `POST /qft` | Build & simulate Quantum Fourier Transform |

- **Modular Algorithms Package** (`backend/algorithms/`):
  - `qaoa.py` — QAOA: `run_qaoa`, `generate_qaoa_code`, per-framework helpers.
  - `vqe.py` — VQE: `run_vqe`, `maxcut_hamiltonian_from_adjacency`, `generate_vqe_code`, `generate_maxcut_code`.
  - `quantum_walk.py` — CTQW: `run_quantum_walk`, `generate_walk_code`.
  - `hamiltonian.py` — Hamiltonian parsing (Pauli strings → SparsePauliOp).
  - `__init__.py` — Re-exports all public functions.

- **Supported Gate Library**:

  | Category | Gates |
  |----------|-------|
  | Single-qubit (fixed) | H, X, Y, Z, S, T |
  | Single-qubit (parameterised) | RX(θ), RY(θ), RZ(θ) |
  | Two-qubit (fixed) | CNOT/CX, CY, CZ, CH, SWAP |
  | Two-qubit (parameterised) | CRX(θ), CRY(θ), CRZ(θ), CP(θ) |
  | Three-qubit | CCX (Toffoli), CSWAP (Fredkin) |
  | Measurement | M |

- **QFT Builder**:
  - Constructs QFT circuits using H + CP + SWAP.
  - Supports forward QFT and inverse QFT (QFT†).
  - Accepts optional initial-state bitstring.

- **Core Logic**:
  - **Simulation** — `qiskit-aer` for statevector / QASM simulation.
  - **Transpilation** — `qiskit.transpile` at optimisation level 3.
  - **Visualisation** — `circuit.draw()` with `mpl` and `latex_source` backends; partial-trace Bloch vectors.

---

### 3. DevOps & Deployment

- **Docker**:
  - `Dockerfile` for Backend (Python 3.9-slim + texlive for LaTeX).
  - `Dockerfile` for Frontend (Node 22-alpine + Next.js dev server).
- **Orchestration**:
  - `docker-compose.yml` — single-command startup for both services.
- **Production deployment** — see [DEPLOYMENT.md](DEPLOYMENT.md) for Railway, Render, AWS, and VPS guides.

---

## Technology Stack

| Component | Technologies |
|-----------|-------------|
| Frontend | Next.js 16, TypeScript, TailwindCSS 4, Lucide React, Recharts, Axios, @dnd-kit, clsx |
| Backend | Python 3.9, FastAPI, Pydantic, Uvicorn |
| Quantum SDK | Qiskit, Qiskit Aer, SciPy, NumPy |
| Visualisation | Matplotlib, PyLaTeXEnc |
| DevOps | Docker, Docker Compose |

---

## Project Structure

```
quantum-circuit-debugger/
├── README.md
├── PROJECT_DOCUMENTATION.md
├── DEPLOYMENT.md
├── docker-compose.yml
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                   # FastAPI app + all endpoints
│   ├── simulation.py             # Circuit builder + Aer simulator
│   ├── models.py                 # Pydantic request/response schemas
│   └── algorithms/
│       ├── __init__.py
│       ├── qaoa.py               # QAOA logic + code generation
│       ├── vqe.py                # VQE logic + MaxCut + code generation
│       ├── quantum_walk.py       # CTQW logic + code generation
│       └── hamiltonian.py        # Pauli string parsing
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── app/                      # Next.js pages
    ├── components/
    │   ├── CircuitBoard.tsx       # Main circuit grid
    │   ├── CircuitCell.tsx        # Individual cell (gate rendering)
    │   ├── GatePalette.tsx        # Drag-and-drop gate palette
    │   ├── AlgorithmModal.tsx     # QAOA / VQE / Walk config + results
    │   └── GraphVisualization.tsx # Graph viz for MaxCut solutions
    └── utils/
        ├── api.ts                # Backend API client
        └── export.ts             # Frontend export helpers
```

---

## How to Run

### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## API Reference

Interactive Swagger documentation is available at http://localhost:8000/docs when the backend is running.

---

## Future Roadmap
- Integration with real quantum hardware (IBM Quantum).
- User authentication and cloud storage for circuits.
- Advanced noise models and error mitigation.
- Step-by-step statevector debugging (visualisation at each gate).
