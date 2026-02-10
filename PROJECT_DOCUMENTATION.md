# Quantum Circuit Debugger — Project Documentation

## Project Overview

A web-based **Quantum Circuit Debugger & Visualiser** that provides an interactive way to design, simulate, optimise, and debug quantum circuits. Built with a **Next.js frontend** and a **FastAPI backend** powered by **Qiskit**.

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

- **Advanced Algorithms**:
  - **VQE / QAOA modal** — configure Hamiltonian, optimiser, and iterations.
  - **Convergence plot** — real-time energy vs. iteration line chart.
  - **Optimal parameters** — displayed after convergence.

- **Export Capabilities** (5 frameworks):
  - **Qiskit** (Python) — fully executable circuit code.
  - **OpenQASM 2.0** — standard quantum assembly.
  - **PennyLane** (Python) — differentiable quantum circuit.
  - **Cirq** (Python) — Google's quantum framework.
  - **Q#** (Microsoft) — .NET quantum programs.
  - **LaTeX** — circuit diagram source code.
  - **Image (PNG)** — high-quality circuit diagram download.

### 2. Backend (FastAPI & Python)

- **API Endpoints**:

  | Endpoint | Description |
  |----------|-------------|
  | `POST /execute` | Simulate circuit → measurement counts + statevector |
  | `POST /optimize` | Transpile and report depth/gate-count improvements |
  | `POST /export/latex` | Generate LaTeX source |
  | `POST /export/image` | Generate Base64 PNG |
  | `POST /export/bloch` | Per-qubit Bloch sphere images |
  | `POST /run-algorithm` | VQE / QAOA variational algorithm |
  | `POST /qft` | Build & simulate Quantum Fourier Transform |

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
  - Constructs a Quantum Fourier Transform circuit using H + CP + SWAP.
  - Supports forward QFT and inverse QFT (QFT†).
  - Accepts optional initial-state bitstring.

- **Core Logic**:
  - **Simulation** — `qiskit-aer` for high-performance statevector / qasm simulation.
  - **Transpilation** — `qiskit.transpile` at optimisation level 3.
  - **Visualisation** — `circuit.draw()` with `mpl` and `latex_source` backends; partial-trace Bloch vectors.

### 3. DevOps & Deployment

- **Docker**:
  - `Dockerfile` for Backend (Python 3.9 slim).
  - `Dockerfile` for Frontend (Node 18 Alpine).
- **Orchestration**:
  - `docker-compose.yml` — single-command startup for both services.

## Technology Stack

| Component | Technologies |
|-----------|-------------|
| Frontend | Next.js, TypeScript, TailwindCSS, Lucide React, Recharts, Axios, @dnd-kit |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Quantum SDK | Qiskit, Qiskit Aer |
| Tools | Docker, Docker Compose |

## How to Run

### Option 1: Docker (Recommended)
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

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

## API Reference

Interactive Swagger documentation is available at http://localhost:8000/docs when the backend is running.

## Future Roadmap
- Integration with real quantum hardware (IBM Quantum).
- User authentication and cloud storage for circuits.
- Advanced noise models and error mitigation.
- Step-by-step statevector debugging (visualisation at each gate).
