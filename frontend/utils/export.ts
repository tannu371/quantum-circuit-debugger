import { QuantumGate } from './api';

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

export const generateOpenQASM = (gates: QuantumGate[], numQubits: number): string => {
    let code = `OPENQASM 2.0;\ninclude "qelib1.inc";\n`;
    code += `qreg q[${numQubits}];\ncreg c[${numQubits}];\n\n`;

    gates.forEach(gate => {
        const name = gate.name.toLowerCase();
        const qubits = gate.qubits;
        
        if (['h', 'x', 'y', 'z'].includes(name)) {
            code += `${name} q[${qubits[0]}];\n`;
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
