# Quantum Circuit Debugger - Walkthrough

## Overview
The Quantum Circuit Debugger is a web-based platform for designing, simulating, and optimizing quantum circuits. It provides a visual drag-and-drop interface, supports execution via Qiskit, and offers advanced features like step-by-step visualization and circuit optimization.

## Key Features

### 1. Circuit Builder
- **Drag-and-Drop Interface**: intuitive grid for placing quantum gates.
- **Support for Multi-Qubit Gates**: CNOT, SWAP, etc.
- **Undo/Redo**: Full history support for circuit modifications.

### 2. Simulation & Analysis
- **Execution**: Run circuits on a Qiskit simulator backend.
- **State Visualization**: View probability distributions of quantum states.
- **Step-by-Step Debugging**: (Planned) Inspect state vectors at each step.

### 3. Optimization
- **Circuit Optimization**: Automatically optimize circuits to reduce depth and gate count.
- **Metrics**: Compare original vs. optimized depth and operation counts.

### 4. Export & Sharing
- **Code Export**: Generate Python (Qiskit, Cirq, PennyLane), OpenQASM, and LaTeX code.
- **Image Export**: Download circuit diagrams as PNG images.
- **Save/Load**: Save circuit designs to JSON files and reload them later.

## Architecture
- **Frontend**: Next.js (React), TailwindCSS, @dnd-kit
- **Backend**: FastAPI (Python), Qiskit, Numpy
- **Communication**: REST API

## Running the Project

### Using Docker (Recommended)
You can run the entire stack using Docker Compose:

```bash
docker-compose up --build
```

Access the application at `http://localhost:3000`.

### Manual Setup
**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Future Improvements
- Integration with real quantum hardware (IBM Quantum).
- Advanced noise simulation models.
- User accounts and cloud storage for circuits.
