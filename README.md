# Quantum Circuit Debugger

A web-based platform for designing, simulating, optimising, and debugging quantum circuits — with integrated variational algorithms (VQE, QAOA), quantum walks, and MaxCut graph clustering. Built with Next.js, FastAPI, and Qiskit.

---

## Features

### Circuit Builder
- **Drag-and-Drop Interface** — intuitive grid for placing quantum gates.
- **20+ Gate Library** across five categories:

| Category | Gates |
|----------|-------|
| Basic | H, X, Y, Z, S, T |
| Rotation | RX(θ), RY(θ), RZ(θ) |
| Controlled | CX (CNOT), CY, CZ, CH, CRX(θ), CRY(θ), CRZ(θ), CP(θ) |
| Multi-Qubit | SWAP, CCX (Toffoli), CSWAP (Fredkin) |
| Utility | Measurement (M) |

- **Undo / Redo** — full history for circuit modifications.
- **Save / Load** — persist circuits to JSON and reload them.

### Simulation & Analysis
- **Qiskit Aer backend** — statevector and QASM simulation.
- **Probability bar charts** — measurement distribution via Recharts.
- **Live Bloch Sphere** — per-qubit Bloch sphere updates as you build.
- **Transpiler Optimisation** — level-3 optimisation with before/after metrics.

### Advanced Algorithms

#### QAOA (Quantum Approximate Optimisation)
- Configurable p-layers, optimizer, and shots.
- Built-in presets: MaxCut K₄, Ising Chain, Vertex Cover, and custom Hamiltonians.
- Convergence plot, optimal γ/β parameters, and solution graph visualization.

#### VQE (Variational Quantum Eigensolver)
- **Hamiltonian mode** — specify Pauli basis strings and coefficients directly.
- **MaxCut Graph mode** — input an adjacency matrix to auto-generate Z⊗Z Hamiltonians.
  - Presets: Example (4v), Triangle (3v), Path (4v), Complete K₄, Custom.
  - Optional adjacency inversion (1−A) for similarity matrices.
  - Graph visualization with cluster coloring (Cluster A / B).
  - Derived Hamiltonian terms displayed in results.
- Class-based code generation (`QuantumMaxCutClustering`) for Qiskit, PennyLane, and Cirq.

#### Quantum Walk (CTQW)
- Continuous-time quantum walk on configurable graph topologies.
- Topologies: Cycle, Path, Complete, Star, Custom adjacency.
- Time-evolution probability charts and most-likely vertex.

### Quantum Fourier Transform (QFT)
- Dedicated QFT endpoint — forward and inverse QFT circuits.
- Custom initial states (bitstring input).
- Returns statevector, counts, circuit depth, and gate count.

### Export & Sharing (5 Frameworks)
- **Qiskit** (Python), **OpenQASM 2.0**, **PennyLane**, **Cirq**, **Q#**.
- **LaTeX** source and **PNG image** export for circuit diagrams.

---

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, TypeScript, TailwindCSS 4, @dnd-kit, Recharts |
| Backend | FastAPI, Python 3.9, Pydantic, Uvicorn |
| Quantum SDK | Qiskit, Qiskit Aer, SciPy |
| DevOps | Docker, Docker Compose |

### Backend Modules

```
backend/
├── main.py                 # FastAPI app + all endpoints
├── simulation.py           # Qiskit circuit builder + simulator
├── models.py               # Pydantic request/response models
└── algorithms/
    ├── __init__.py          # Re-exports
    ├── qaoa.py              # QAOA: run_qaoa + code generation
    ├── vqe.py               # VQE: run_vqe + MaxCut Hamiltonian + code gen
    ├── quantum_walk.py      # CTQW simulation + code generation
    └── hamiltonian.py       # Hamiltonian parsing utilities
```

---

## Running the Project

### Docker (Recommended)
```bash
docker-compose up --build
```
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Swagger Docs**: http://localhost:8000/docs

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

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root health message |
| GET | `/health` | Health check |
| POST | `/execute` | Simulate circuit → counts + statevector |
| POST | `/optimize` | Transpiler-based optimisation report |
| POST | `/export/latex` | LaTeX source code |
| POST | `/export/image` | Base64 PNG circuit image |
| POST | `/export/bloch` | Per-qubit Bloch sphere images |
| POST | `/qaoa` | QAOA execution (MaxCut, Vertex Cover, custom) |
| POST | `/vqe` | VQE execution (Hamiltonian or MaxCut graph) |
| POST | `/quantum-walk` | Continuous-time quantum walk |
| POST | `/qft` | QFT circuit simulation |

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed instructions on deploying to production (Railway, Render, AWS, VPS, etc.).

---

## Future Improvements
- Integration with real quantum hardware (IBM Quantum).
- Advanced noise simulation and error mitigation.
- User accounts and cloud storage for circuits.
- Step-by-step statevector debugging at each gate.
