import { QuantumGate } from './api';

/**
 * Generates Qiskit (Python) code to reconstruct the current circuit.
 * @param gates List of gates in the circuit.
 * @param numQubits Number of qubits.
 * @returns Python code string.
 */
export const generateQiskitCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `from qiskit import QuantumCircuit\n\n`;
    code += `qc = QuantumCircuit(${numQubits})\n\n`;

    gates.forEach(gate => {
        const name = gate.name.toUpperCase();
        const qubits = gate.qubits;
        
        if (name === 'H') {
            code += `qc.h(${qubits[0]})\n`;
        } else if (name === 'X') {
            code += `qc.x(${qubits[0]})\n`;
        } else if (name === 'Y') {
            code += `qc.y(${qubits[0]})\n`;
        } else if (name === 'Z') {
            code += `qc.z(${qubits[0]})\n`;
        } else if (name === 'RX') {
            code += `qc.rx(${gate.params?.[0] || 'np.pi/2'}, ${qubits[0]})\n`;
        } else if (name === 'RY') {
            code += `qc.ry(${gate.params?.[0] || 'np.pi/2'}, ${qubits[0]})\n`;
        } else if (name === 'RZ') {
            code += `qc.rz(${gate.params?.[0] || 'np.pi/2'}, ${qubits[0]})\n`;
        } else if (name === 'CNOT' || name === 'CX') {
             if (qubits.length >= 2) {
                code += `qc.cx(${qubits[0]}, ${qubits[1]})\n`;
             }
        } else if (name === 'M') {
            code += `qc.measure_all()\n`;
        } else {
             code += `# TODO: Implement ${name} gate\n`;
        }
    });

    code += `\nprint(qc)\n`;
    return code;
};

/**
 * Generates OpenQASM 2.0 code for the current circuit.
 * @param gates List of gates in the circuit.
 * @param numQubits Number of qubits.
 * @returns OpenQASM code string.
 */
export const generateOpenQASM = (gates: QuantumGate[], numQubits: number): string => {
    let code = `OPENQASM 2.0;\ninclude "qelib1.inc";\n`;
    code += `qreg q[${numQubits}];\ncreg c[${numQubits}];\n\n`;

    gates.forEach(gate => {
        const name = gate.name.toLowerCase();
        const qubits = gate.qubits;
        
        if (['h', 'x', 'y', 'z'].includes(name)) {
            code += `${name} q[${qubits[0]}];\n`;
        } else if (name === 'rx') {
            code += `rx(${gate.params?.[0] || 'pi/2'}) q[${qubits[0]}];\n`;
        } else if (name === 'ry') {
            code += `ry(${gate.params?.[0] || 'pi/2'}) q[${qubits[0]}];\n`;
        } else if (name === 'rz') {
            code += `rz(${gate.params?.[0] || 'pi/2'}) q[${qubits[0]}];\n`;
        } else if (name === 'cnot' || name === 'cx') {
             if (qubits.length >= 2) {
                code += `cx q[${qubits[0]}], q[${qubits[1]}];\n`;
             }
        } else if (name === 'm') {
            code += `measure q -> c;\n`;
        }
    });

    return code;
};

/**
 * Generates PennyLane (Python) code for the current circuit.
 * @param gates List of gates in the circuit.
 * @param numQubits Number of qubits.
 * @returns PennyLane code string.
 */
export const generatePennyLaneCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `import pennylane as qml\nimport numpy as np\n\n`;
    code += `dev = qml.device("default.qubit", wires=${numQubits})\n\n`;
    code += `@qml.qnode(dev)\n`;
    code += `def circuit():\n`;

    gates.forEach(gate => {
        const name = gate.name.toUpperCase();
        const qubits = gate.qubits;
        
        if (name === 'H') {
            code += `    qml.Hadamard(wires=${qubits[0]})\n`;
        } else if (name === 'X') {
            code += `    qml.PauliX(wires=${qubits[0]})\n`;
        } else if (name === 'Y') {
            code += `    qml.PauliY(wires=${qubits[0]})\n`;
        } else if (name === 'Z') {
            code += `    qml.PauliZ(wires=${qubits[0]})\n`;
        } else if (name === 'RX') {
            code += `    qml.RX(${gate.params?.[0] || 'np.pi/2'}, wires=${qubits[0]})\n`;
        } else if (name === 'RY') {
            code += `    qml.RY(${gate.params?.[0] || 'np.pi/2'}, wires=${qubits[0]})\n`;
        } else if (name === 'RZ') {
            code += `    qml.RZ(${gate.params?.[0] || 'np.pi/2'}, wires=${qubits[0]})\n`;
        } else if (name === 'CNOT' || name === 'CX') {
             if (qubits.length >= 2) {
                code += `    qml.CNOT(wires=[${qubits[0]}, ${qubits[1]}])\n`;
             }
        } else if (name === 'M') {
            // PennyLane typically returns measurements at the end
        } else {
             code += `    # TODO: Implement ${name} gate\n`;
        }
    });

    // Return probabilities for all wires as a default equivalent to statevector/counts
    code += `    return qml.probs(wires=[${Array.from({length: numQubits}, (_, i) => i).join(', ')}])\n`;
    code += `\nprint(circuit())\n`;
    return code;
};

/**
 * Generates Cirq (Python) code for the current circuit.
 * @param gates List of gates in the circuit.
 * @param numQubits Number of qubits.
 * @returns Cirq code string.
 */
export const generateCirqCode = (gates: QuantumGate[], numQubits: number): string => {
    let code = `import cirq\n\n`;
    code += `# Define qubits\n`;
    code += `qubits = [cirq.LineQubit(i) for i in range(${numQubits})]\n\n`;
    code += `circuit = cirq.Circuit()\n`;

    gates.forEach(gate => {
        const name = gate.name.toUpperCase();
        const qubits = gate.qubits;
        
        if (name === 'H') {
            code += `circuit.append(cirq.H(qubits[${qubits[0]}]))\n`;
        } else if (name === 'X') {
            code += `circuit.append(cirq.X(qubits[${qubits[0]}]))\n`;
        } else if (name === 'Y') {
            code += `circuit.append(cirq.Y(qubits[${qubits[0]}]))\n`;
        } else if (name === 'Z') {
            code += `circuit.append(cirq.Z(qubits[${qubits[0]}]))\n`;
        } else if (name === 'RX') {
            code += `circuit.append(cirq.rx(${gate.params?.[0] || 'np.pi/2'})(qubits[${qubits[0]}]))\n`;
        } else if (name === 'RY') {
            code += `circuit.append(cirq.ry(${gate.params?.[0] || 'np.pi/2'})(qubits[${qubits[0]}]))\n`;
        } else if (name === 'RZ') {
            code += `circuit.append(cirq.rz(${gate.params?.[0] || 'np.pi/2'})(qubits[${qubits[0]}]))\n`;
        } else if (name === 'CNOT' || name === 'CX') {
             if (qubits.length >= 2) {
                code += `circuit.append(cirq.CNOT(qubits[${qubits[0]}], qubits[${qubits[1]}]))\n`;
             }
        } else if (name === 'M') {
            code += `circuit.append(cirq.measure(*qubits, key='result'))\n`;
        } else {
             code += `# TODO: Implement ${name} gate\n`;
        }
    });

    code += `\nprint(circuit)\n`;
    return code;
};

/**
 * Generates Q# code for the current circuit.
 * @param gates List of gates in the circuit.
 * @param numQubits Number of qubits.
 * @returns Q# code string.
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

    gates.forEach(gate => {
        const qIndices = gate.qubits.map(q => `q[${q}]`);
        const params = gate.params || [];
        
        switch (gate.name) {
            case 'H':
                code += `        H(${qIndices[0]});\n`;
                break;
            case 'X':
                code += `        X(${qIndices[0]});\n`;
                break;
            case 'Y':
                code += `        Y(${qIndices[0]});\n`;
                break;
            case 'Z':
                code += `        Z(${qIndices[0]});\n`;
                break;
            case 'RX':
                code += `        Rx(${params[0] || Math.PI/2}, ${qIndices[0]});\n`;
                break;
            case 'RY':
                code += `        Ry(${params[0] || Math.PI/2}, ${qIndices[0]});\n`;
                break;
            case 'RZ':
                code += `        Rz(${params[0] || Math.PI/2}, ${qIndices[0]});\n`;
                break;
            case 'CNOT':
            case 'CX':
                if (gate.qubits.length === 2) {
                    code += `        CNOT(${qIndices[0]}, ${qIndices[1]});\n`;
                }
                break;
            case 'M':
                // Measurements are handled at the end
                break;
            default:
                code += `        // TODO: Implement ${gate.name} gate\n`;
        }
    });

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
