import axios from 'axios';

const API_URL = 'http://localhost:8000';

/**
 * Represents a quantum gate in the circuit model.
 */
export interface QuantumGate {
    name: string;
    qubits: number[];
    params?: number[];
}

/**
 * Result of a circuit execution.
 */
export interface ExecutionResult {
    counts: Record<string, number>;
    statevector?: number[][]; // [[real, imag], ...]
    status: string;
    error?: string;
}

/**
 * Sends the circuit to the backend for execution.
 * @param gates List of gates in the circuit.
 * @param numQubits Total number of qubits.
 * @param shots Number of simulation shots (default 1024).
 */
export const executeCircuit = async (gates: QuantumGate[], numQubits: number, shots: number = 1024): Promise<ExecutionResult> => {
    try {
        const response = await axios.post(`${API_URL}/execute`, {
            gates,
            num_qubits: numQubits,
            shots
        });
        return response.data;
    } catch (error) {
        console.error('Error executing circuit:', error);
        throw error;
    }
};

/**
 * Result of circuit optimization.
 */
export interface OptimizationResult {
    original_depth: number;
    optimized_depth: number;
    original_ops: Record<string, number>;
    optimized_ops: Record<string, number>;
    optimized_qasm: string;
    improvement_msg: string;
    error?: string;
}

/**
 * Sends the circuit to the backend for optimization.
 * @param gates List of gates in the circuit.
 * @param numQubits Total number of qubits.
 */
export const optimizeCircuit = async (gates: QuantumGate[], numQubits: number): Promise<OptimizationResult> => {
    try {
        const response = await axios.post(`${API_URL}/optimize`, {
            gates,
            num_qubits: numQubits
        });
        return response.data;
    } catch (error) {
        console.error('Error optimizing circuit:', error);
        throw error;
    }
};

/**
 * Requests LaTeX source code for the circuit.
 */
export const exportToLatex = async (gates: QuantumGate[], numQubits: number): Promise<{ latex: string }> => {
    const response = await axios.post(`${API_URL}/export/latex`, { gates, num_qubits: numQubits });
    return response.data;
};

/**
 * Requests a rendered image of the circuit.
 */
export const exportToImage = async (gates: QuantumGate[], numQubits: number): Promise<{ image_base64: string }> => {
    const response = await axios.post(`${API_URL}/export/image`, { gates, num_qubits: numQubits });
    return response.data;
};

/**
 * Requests a Bloch sphere visualization of the circuit state.
 */
export const exportToBloch = async (gates: QuantumGate[], numQubits: number): Promise<{ image_base64: string }> => {
    const response = await axios.post(`${API_URL}/export/bloch`, { gates, num_qubits: numQubits });
    return response.data;
};
