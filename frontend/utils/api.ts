import axios from 'axios';

const API_URL = 'http://localhost:8000';

export interface QuantumGate {
    name: string;
    qubits: number[];
    params?: number[];
}

export interface ExecutionResult {
    counts: Record<string, number>;
    statevector?: number[][]; // [[real, imag], ...]
    status: string;
    error?: string;
}

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
export interface OptimizationResult {
    original_depth: number;
    optimized_depth: number;
    original_ops: Record<string, number>;
    optimized_ops: Record<string, number>;
    optimized_qasm: string;
    improvement_msg: string;
    error?: string;
}

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

export const exportToLatex = async (gates: QuantumGate[], numQubits: number): Promise<{ latex: string }> => {
    const response = await axios.post(`${API_URL}/export/latex`, { gates, num_qubits: numQubits });
    return response.data;
};

export const exportToImage = async (gates: QuantumGate[], numQubits: number): Promise<{ image_base64: string }> => {
    const response = await axios.post(`${API_URL}/export/image`, { gates, num_qubits: numQubits });
    return response.data;
};
