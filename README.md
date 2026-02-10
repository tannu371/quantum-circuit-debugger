# Quantum Circuit Debugger

A web-based platform for designing, simulating, optimising, and debugging quantum circuits with a visual drag-and-drop interface powered by Qiskit.

## Key Features

### Circuit Builder
- **Drag-and-Drop Interface** — intuitive grid for placing quantum gates.
- **Comprehensive Gate Library** — 20+ gates across five categories:

| Category | Gates |
|----------|-------|
| Basic | H, X, Y, Z, S, T |
| Rotation | RX(θ), RY(θ), RZ(θ) |
| Controlled | CX (CNOT), CY, CZ, CH, CRX(θ), CRY(θ), CRZ(θ) |
| Multi-Qubit | SWAP, CCX (Toffoli), CSWAP (Fredkin) |
| Utility | Measurement (M) |

- **Undo / Redo** — full history for circuit modifications.
- **Save / Load** — persist circuits to JSON and reload them.

### Simulation & Analysis
- **Execution** — run circuits on a Qiskit Aer simulator backend.
- **State Visualization** — probability distributions via bar charts.
- **Live Bloch Sphere** — per-qubit Bloch sphere that updates as you build.

### Quantum Fourier Transform (QFT)
- Dedicated **QFT endpoint** — build and simulate QFT / QFT† circuits.
- Supports custom initial states (bitstring input).
- Returns statevector, measurement counts, circuit depth, and gate count.

### Optimisation
- **Transpiler-based optimisation** — automatically reduces depth and gate count (level 3).
- **Before / After metrics** — compare original vs. optimised circuit.

### Advanced Algorithms
- **VQE** (Variational Quantum Eigensolver) — find ground-state energies.
- **QAOA** (Quantum Approximate Optimisation) — combinatorial optimisation.
- Interactive convergence plots and parameter tuning.

### Export & Sharing
- **Code Export** — Qiskit, OpenQASM, PennyLane, Cirq, Q#.
- **Image Export** — download circuit diagrams as PNG.
- **LaTeX Export** — generate LaTeX source for academic papers.

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Next.js, TypeScript, TailwindCSS, @dnd-kit, Recharts |
| Backend | FastAPI, Python, Pydantic, Uvicorn |
| Quantum SDK | Qiskit, Qiskit Aer |
| DevOps | Docker, Docker Compose |

## Running the Project

### Docker (Recommended)
```bash
docker-compose up --build
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs

### Manual Setup

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

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root health message |
| GET | `/health` | Health check |
| POST | `/execute` | Simulate circuit → counts + statevector |
| POST | `/optimize` | Transpiler-based optimisation report |
| POST | `/export/latex` | LaTeX source code |
| POST | `/export/image` | Base64 PNG image |
| POST | `/export/bloch` | Per-qubit Bloch sphere images |
| POST | `/run-algorithm` | VQE / QAOA execution |
| POST | `/qft` | QFT circuit simulation |

## Future Improvements
- Integration with real quantum hardware (IBM Quantum).
- Advanced noise simulation and error mitigation.
- User accounts and cloud storage for circuits.
- Step-by-step statevector debugging at each gate.
