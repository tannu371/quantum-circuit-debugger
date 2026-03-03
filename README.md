# Quantum Circuit Debugger

A web-based platform for designing, simulating, optimising, and debugging quantum circuits — with integrated variational algorithms (VQE, QAOA), continuous-time quantum walks, and MaxCut graph clustering. Built with **Next.js**, **FastAPI**, and **Qiskit**.

---

## Features

### Circuit Builder
- **Drag-and-Drop Interface** — intuitive grid for placing quantum gates via `@dnd-kit`.
- **20+ Gate Library** across five categories:

| Category | Gates |
|----------|-------|
| Basic | H, X, Y, Z, S, T |
| Rotation | RX(θ), RY(θ), RZ(θ) |
| Controlled | CX (CNOT), CY, CZ, CH, CRX(θ), CRY(θ), CRZ(θ), CP(θ) |
| Multi-Qubit | SWAP, CCX (Toffoli), CSWAP (Fredkin) |
| Utility | Measurement (M) |

- **Angle Editing** — double-click rotation/controlled-rotation gates to set angles (radians or π multiples).
- **Undo / Redo** — full history for circuit modifications.
- **Save / Load** — persist circuits to JSON and reload them.
- **Dynamically resizable grid** — default 3 qubits, 10 steps.

### Simulation & Analysis
- **Qiskit Aer backend** — statevector and QASM simulation.
- **Probability bar charts** — measurement distribution via Recharts.
- **Live Bloch Sphere** — per-qubit Bloch sphere updates as you build.
- **Transpiler Optimisation** — level-3 optimisation with before/after depth and gate-count metrics + OpenQASM output.

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
  - Class-based code generation (`QuantumMaxCutClustering`) for all 5 frameworks.

#### Quantum Walk (CTQW)
- Continuous-time quantum walk on configurable graph topologies.
- Topologies: Cycle, Path, Complete, Star, Custom adjacency.
- Time-evolution probability charts and most-likely vertex.

### Quantum Fourier Transform (QFT)
- Dedicated QFT endpoint — forward and inverse QFT circuits.
- Custom initial states (bitstring input).
- Returns statevector, counts, circuit depth, and gate count.

### Export & Sharing (5 Frameworks + Image)
- **Qiskit** (Python), **OpenQASM 2.0**, **PennyLane**, **Cirq**, **Q#** — fully executable, class-based code.
- **LaTeX** source and **PNG image** export for circuit diagrams.

---

## Architecture

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15+, TypeScript, TailwindCSS 4, @dnd-kit, Recharts, Lucide React |
| Backend | FastAPI, Python 3.9+, Pydantic v2, Uvicorn |
| Quantum SDK | Qiskit, Qiskit Aer, SciPy, NumPy |
| Visualisation | Matplotlib |
| DevOps | Docker, Docker Compose |

### Project Structure

```
quantum-circuit-debugger/
├── README.md
├── INTERVIEW_PREP.md
├── DEPLOYMENT.md
├── docker-compose.yml
├── docker-compose.prod.yml
│
├── backend/
│   ├── Dockerfile / Dockerfile.prod
│   ├── requirements.txt
│   ├── main.py              # FastAPI app + all endpoints
│   ├── simulation.py        # Circuit builder + Aer simulator + QFT
│   ├── models.py            # Pydantic request/response schemas
│   ├── optimization.py      # Qiskit transpiler optimisation
│   └── algorithms/
│       ├── __init__.py
│       ├── qaoa.py          # QAOA: run_qaoa + code generation
│       ├── vqe.py           # VQE: run_vqe + MaxCut Hamiltonian + code gen
│       ├── quantum_walk.py  # CTQW simulation + code generation
│       └── hamiltonian.py   # Pauli string parsing utilities
│
└── frontend/
    ├── Dockerfile / Dockerfile.prod
    ├── package.json
    ├── app/                 # Next.js App Router pages
    ├── components/
    │   ├── CircuitBoard.tsx        # Main circuit grid
    │   ├── CircuitCell.tsx         # Individual cell (gate rendering)
    │   ├── GatePalette.tsx         # Drag-and-drop gate palette
    │   ├── AlgorithmModal.tsx      # QAOA / VQE / Walk config + results
    │   └── GraphVisualization.tsx  # Graph viz for MaxCut solutions
    └── utils/
        ├── api.ts           # Backend API client
        └── export.ts        # Frontend export helpers
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

Interactive Swagger docs available at **http://localhost:8000/docs** when the backend is running.

---

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed instructions on deploying to production (Railway, Render, AWS, VPS, etc.).

---

## Future Improvements
- Integration with real quantum hardware (IBM Quantum).
- Advanced noise simulation and error mitigation.
- User accounts and cloud storage for circuits.
- Step-by-step statevector debugging at each gate.
