/**
 * export.ts — Client-side code generators for quantum circuits.
 *
 * Each function takes a list of QuantumGate objects and the qubit count,
 * producing a string of executable source code for the target framework.
 *
 * Supported targets: Qiskit, OpenQASM 2.0, PennyLane, Cirq, Q#.
 */

import { QuantumGate } from './api';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Format a numeric parameter, falling back to a symbolic default. */
const fmtParam = (gate: QuantumGate, fallback: string = 'np.pi/2'): string =>
    gate.params?.[0] !== undefined ? String(gate.params[0]) : fallback;

// ---------------------------------------------------------------------------
// Qiskit
// ---------------------------------------------------------------------------

/**
 * Generate Qiskit (Python) code for the circuit.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @returns         Python source string.
 */
export const generateQiskitCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `from qiskit import QuantumCircuit\nimport numpy as np\n\n`;
    code += `qc = QuantumCircuit(${numQubits})\n\n`;

    for (const gate of gates) {
        const name = gate.name.toUpperCase();
        const q = gate.qubits;

        switch (name) {
            // Single-qubit
            case 'H':     code += `qc.h(${q[0]})\n`; break;
            case 'X':     code += `qc.x(${q[0]})\n`; break;
            case 'Y':     code += `qc.y(${q[0]})\n`; break;
            case 'Z':     code += `qc.z(${q[0]})\n`; break;
            case 'S':     code += `qc.s(${q[0]})\n`; break;
            case 'T':     code += `qc.t(${q[0]})\n`; break;

            // Single-qubit rotations
            case 'RX':    code += `qc.rx(${fmtParam(gate)}, ${q[0]})\n`; break;
            case 'RY':    code += `qc.ry(${fmtParam(gate)}, ${q[0]})\n`; break;
            case 'RZ':    code += `qc.rz(${fmtParam(gate)}, ${q[0]})\n`; break;

            // Two-qubit
            case 'CNOT': case 'CX':
                if (q.length >= 2) code += `qc.cx(${q[0]}, ${q[1]})\n`; break;
            case 'CY':
                if (q.length >= 2) code += `qc.cy(${q[0]}, ${q[1]})\n`; break;
            case 'CZ':
                if (q.length >= 2) code += `qc.cz(${q[0]}, ${q[1]})\n`; break;
            case 'CH':
                if (q.length >= 2) code += `qc.ch(${q[0]}, ${q[1]})\n`; break;
            case 'SWAP':
                if (q.length >= 2) code += `qc.swap(${q[0]}, ${q[1]})\n`; break;

            // Controlled rotations
            case 'CRX':
                if (q.length >= 2) code += `qc.crx(${fmtParam(gate)}, ${q[0]}, ${q[1]})\n`; break;
            case 'CRY':
                if (q.length >= 2) code += `qc.cry(${fmtParam(gate)}, ${q[0]}, ${q[1]})\n`; break;
            case 'CRZ':
                if (q.length >= 2) code += `qc.crz(${fmtParam(gate)}, ${q[0]}, ${q[1]})\n`; break;

            // Three-qubit
            case 'CCX': case 'TOFFOLI':
                if (q.length >= 3) code += `qc.ccx(${q[0]}, ${q[1]}, ${q[2]})\n`; break;
            case 'CSWAP': case 'FREDKIN':
                if (q.length >= 3) code += `qc.cswap(${q[0]}, ${q[1]}, ${q[2]})\n`; break;

            // Measurement
            case 'M':     code += `qc.measure_all()\n`; break;

            default:      code += `# TODO: Implement ${name} gate\n`;
        }
    }

    code += `\nprint(qc)\n`;
    return code;
};

// ---------------------------------------------------------------------------
// OpenQASM 2.0
// ---------------------------------------------------------------------------

/**
 * Generate OpenQASM 2.0 code for the circuit.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @returns         OpenQASM source string.
 */
export const generateOpenQASM = (gates: QuantumGate[], numQubits: number): string => {
    let code = `OPENQASM 2.0;\ninclude "qelib1.inc";\n`;
    code += `qreg q[${numQubits}];\ncreg c[${numQubits}];\n\n`;

    for (const gate of gates) {
        const name = gate.name.toLowerCase();
        const q = gate.qubits;

        switch (name) {
            case 'h': case 'x': case 'y': case 'z': case 's': case 't':
                code += `${name} q[${q[0]}];\n`; break;

            case 'rx':    code += `rx(${fmtParam(gate, 'pi/2')}) q[${q[0]}];\n`; break;
            case 'ry':    code += `ry(${fmtParam(gate, 'pi/2')}) q[${q[0]}];\n`; break;
            case 'rz':    code += `rz(${fmtParam(gate, 'pi/2')}) q[${q[0]}];\n`; break;

            case 'cnot': case 'cx':
                if (q.length >= 2) code += `cx q[${q[0]}], q[${q[1]}];\n`; break;
            case 'cy':
                if (q.length >= 2) code += `cy q[${q[0]}], q[${q[1]}];\n`; break;
            case 'cz':
                if (q.length >= 2) code += `cz q[${q[0]}], q[${q[1]}];\n`; break;
            case 'ch':
                if (q.length >= 2) code += `ch q[${q[0]}], q[${q[1]}];\n`; break;
            case 'swap':
                if (q.length >= 2) code += `swap q[${q[0]}], q[${q[1]}];\n`; break;

            case 'crx':
                if (q.length >= 2) code += `crx(${fmtParam(gate, 'pi/2')}) q[${q[0]}], q[${q[1]}];\n`; break;
            case 'cry':
                if (q.length >= 2) code += `cry(${fmtParam(gate, 'pi/2')}) q[${q[0]}], q[${q[1]}];\n`; break;
            case 'crz':
                if (q.length >= 2) code += `crz(${fmtParam(gate, 'pi/2')}) q[${q[0]}], q[${q[1]}];\n`; break;

            case 'ccx': case 'toffoli':
                if (q.length >= 3) code += `ccx q[${q[0]}], q[${q[1]}], q[${q[2]}];\n`; break;
            case 'cswap': case 'fredkin':
                if (q.length >= 3) code += `cswap q[${q[0]}], q[${q[1]}], q[${q[2]}];\n`; break;

            case 'm':     code += `measure q -> c;\n`; break;
        }
    }

    return code;
};

// ---------------------------------------------------------------------------
// PennyLane
// ---------------------------------------------------------------------------

/**
 * Generate PennyLane (Python) code for the circuit.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @returns         Python source string.
 */
export const generatePennyLaneCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `import pennylane as qml\nimport numpy as np\n\n`;
    code += `dev = qml.device("default.qubit", wires=${numQubits})\n\n`;
    code += `@qml.qnode(dev)\ndef circuit():\n`;

    for (const gate of gates) {
        const name = gate.name.toUpperCase();
        const q = gate.qubits;

        switch (name) {
            case 'H':     code += `    qml.Hadamard(wires=${q[0]})\n`; break;
            case 'X':     code += `    qml.PauliX(wires=${q[0]})\n`; break;
            case 'Y':     code += `    qml.PauliY(wires=${q[0]})\n`; break;
            case 'Z':     code += `    qml.PauliZ(wires=${q[0]})\n`; break;
            case 'S':     code += `    qml.S(wires=${q[0]})\n`; break;
            case 'T':     code += `    qml.T(wires=${q[0]})\n`; break;

            case 'RX':    code += `    qml.RX(${fmtParam(gate)}, wires=${q[0]})\n`; break;
            case 'RY':    code += `    qml.RY(${fmtParam(gate)}, wires=${q[0]})\n`; break;
            case 'RZ':    code += `    qml.RZ(${fmtParam(gate)}, wires=${q[0]})\n`; break;

            case 'CNOT': case 'CX':
                if (q.length >= 2) code += `    qml.CNOT(wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'CY':
                if (q.length >= 2) code += `    qml.CY(wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'CZ':
                if (q.length >= 2) code += `    qml.CZ(wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'CH':
                if (q.length >= 2) code += `    qml.CH(wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'SWAP':
                if (q.length >= 2) code += `    qml.SWAP(wires=[${q[0]}, ${q[1]}])\n`; break;

            case 'CRX':
                if (q.length >= 2) code += `    qml.CRX(${fmtParam(gate)}, wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'CRY':
                if (q.length >= 2) code += `    qml.CRY(${fmtParam(gate)}, wires=[${q[0]}, ${q[1]}])\n`; break;
            case 'CRZ':
                if (q.length >= 2) code += `    qml.CRZ(${fmtParam(gate)}, wires=[${q[0]}, ${q[1]}])\n`; break;

            case 'CCX': case 'TOFFOLI':
                if (q.length >= 3) code += `    qml.Toffoli(wires=[${q[0]}, ${q[1]}, ${q[2]}])\n`; break;
            case 'CSWAP': case 'FREDKIN':
                if (q.length >= 3) code += `    qml.CSWAP(wires=[${q[0]}, ${q[1]}, ${q[2]}])\n`; break;

            case 'M':     break; // PennyLane handles measurements via return
            default:      code += `    # TODO: Implement ${name} gate\n`;
        }
    }

    const wires = Array.from({ length: numQubits }, (_, i) => i).join(', ');
    code += `    return qml.probs(wires=[${wires}])\n`;
    code += `\nprint(circuit())\n`;
    return code;
};

// ---------------------------------------------------------------------------
// Cirq
// ---------------------------------------------------------------------------

/**
 * Generate Cirq (Python) code for the circuit.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @returns         Python source string.
 */
export const generateCirqCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `import cirq\nimport numpy as np\n\n`;
    code += `# Define qubits\nqubits = [cirq.LineQubit(i) for i in range(${numQubits})]\n\n`;
    code += `circuit = cirq.Circuit()\n`;

    for (const gate of gates) {
        const name = gate.name.toUpperCase();
        const q = gate.qubits;

        switch (name) {
            case 'H':     code += `circuit.append(cirq.H(qubits[${q[0]}]))\n`; break;
            case 'X':     code += `circuit.append(cirq.X(qubits[${q[0]}]))\n`; break;
            case 'Y':     code += `circuit.append(cirq.Y(qubits[${q[0]}]))\n`; break;
            case 'Z':     code += `circuit.append(cirq.Z(qubits[${q[0]}]))\n`; break;
            case 'S':     code += `circuit.append(cirq.S(qubits[${q[0]}]))\n`; break;
            case 'T':     code += `circuit.append(cirq.T(qubits[${q[0]}]))\n`; break;

            case 'RX':    code += `circuit.append(cirq.rx(${fmtParam(gate)})(qubits[${q[0]}]))\n`; break;
            case 'RY':    code += `circuit.append(cirq.ry(${fmtParam(gate)})(qubits[${q[0]}]))\n`; break;
            case 'RZ':    code += `circuit.append(cirq.rz(${fmtParam(gate)})(qubits[${q[0]}]))\n`; break;

            case 'CNOT': case 'CX':
                if (q.length >= 2) code += `circuit.append(cirq.CNOT(qubits[${q[0]}], qubits[${q[1]}]))\n`; break;
            case 'CZ':
                if (q.length >= 2) code += `circuit.append(cirq.CZ(qubits[${q[0]}], qubits[${q[1]}]))\n`; break;
            case 'SWAP':
                if (q.length >= 2) code += `circuit.append(cirq.SWAP(qubits[${q[0]}], qubits[${q[1]}]))\n`; break;

            case 'CCX': case 'TOFFOLI':
                if (q.length >= 3) code += `circuit.append(cirq.TOFFOLI(qubits[${q[0]}], qubits[${q[1]}], qubits[${q[2]}]))\n`; break;
            case 'CSWAP': case 'FREDKIN':
                if (q.length >= 3) code += `circuit.append(cirq.FREDKIN(qubits[${q[0]}], qubits[${q[1]}], qubits[${q[2]}]))\n`; break;

            // Cirq doesn't have built-in CY/CH/CRX/CRY/CRZ — use controlled()
            case 'CY':
                if (q.length >= 2) code += `circuit.append(cirq.Y(qubits[${q[1]}]).controlled_by(qubits[${q[0]}]))\n`; break;
            case 'CH':
                if (q.length >= 2) code += `circuit.append(cirq.H(qubits[${q[1]}]).controlled_by(qubits[${q[0]}]))\n`; break;
            case 'CRX':
                if (q.length >= 2) code += `circuit.append(cirq.rx(${fmtParam(gate)})(qubits[${q[1]}]).controlled_by(qubits[${q[0]}]))\n`; break;
            case 'CRY':
                if (q.length >= 2) code += `circuit.append(cirq.ry(${fmtParam(gate)})(qubits[${q[1]}]).controlled_by(qubits[${q[0]}]))\n`; break;
            case 'CRZ':
                if (q.length >= 2) code += `circuit.append(cirq.rz(${fmtParam(gate)})(qubits[${q[1]}]).controlled_by(qubits[${q[0]}]))\n`; break;

            case 'M':     code += `circuit.append(cirq.measure(*qubits, key='result'))\n`; break;
            default:      code += `# TODO: Implement ${name} gate\n`;
        }
    }

    code += `\nprint(circuit)\n`;
    return code;
};

// ---------------------------------------------------------------------------
// Q#
// ---------------------------------------------------------------------------

/**
 * Generate Q# code for the circuit.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @returns         Q# source string.
 */
export const generateQSharpCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `namespace QuantumCircuit {
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Canon;
    open Microsoft.Quantum.Measurement;
    open Microsoft.Quantum.Math;

    @EntryPoint()
    operation RunCircuit() : Result[] {
        use q = Qubit[${numQubits}];
        
`;

    for (const gate of gates) {
        const qi = gate.qubits.map((i: number) => `q[${i}]`);
        const p = gate.params || [];

        switch (gate.name.toUpperCase()) {
            case 'H':     code += `        H(${qi[0]});\n`; break;
            case 'X':     code += `        X(${qi[0]});\n`; break;
            case 'Y':     code += `        Y(${qi[0]});\n`; break;
            case 'Z':     code += `        Z(${qi[0]});\n`; break;
            case 'S':     code += `        S(${qi[0]});\n`; break;
            case 'T':     code += `        T(${qi[0]});\n`; break;

            case 'RX':    code += `        Rx(${p[0] || Math.PI / 2}, ${qi[0]});\n`; break;
            case 'RY':    code += `        Ry(${p[0] || Math.PI / 2}, ${qi[0]});\n`; break;
            case 'RZ':    code += `        Rz(${p[0] || Math.PI / 2}, ${qi[0]});\n`; break;

            case 'CNOT': case 'CX':
                if (qi.length >= 2) code += `        CNOT(${qi[0]}, ${qi[1]});\n`; break;
            case 'CY':
                if (qi.length >= 2) code += `        Controlled Y([${qi[0]}], ${qi[1]});\n`; break;
            case 'CZ':
                if (qi.length >= 2) code += `        CZ(${qi[0]}, ${qi[1]});\n`; break;
            case 'CH':
                if (qi.length >= 2) code += `        Controlled H([${qi[0]}], ${qi[1]});\n`; break;
            case 'SWAP':
                if (qi.length >= 2) code += `        SWAP(${qi[0]}, ${qi[1]});\n`; break;

            case 'CRX':
                if (qi.length >= 2) code += `        Controlled Rx([${qi[0]}], (${p[0] || Math.PI / 2}, ${qi[1]}));\n`; break;
            case 'CRY':
                if (qi.length >= 2) code += `        Controlled Ry([${qi[0]}], (${p[0] || Math.PI / 2}, ${qi[1]}));\n`; break;
            case 'CRZ':
                if (qi.length >= 2) code += `        Controlled Rz([${qi[0]}], (${p[0] || Math.PI / 2}, ${qi[1]}));\n`; break;

            case 'CCX': case 'TOFFOLI':
                if (qi.length >= 3) code += `        CCNOT(${qi[0]}, ${qi[1]}, ${qi[2]});\n`; break;
            case 'CSWAP': case 'FREDKIN':
                if (qi.length >= 3) code += `        Controlled SWAP([${qi[0]}], (${qi[1]}, ${qi[2]}));\n`; break;

            case 'M':     break; // Measurements handled at the end
            default:      code += `        // TODO: Implement ${gate.name} gate\n`;
        }
    }

    code += `
        // Measure all qubits
        mutable results = [];
        for (qIndex in 0 .. ${numQubits - 1}) {
            set results += [M(q[qIndex])];
        }
        
        ResetAll(q);
        return results;
    }
}`;
    return code;
};
