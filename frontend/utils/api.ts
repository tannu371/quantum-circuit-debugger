/**
 * api.ts — HTTP client layer for the Quantum Circuit Debugger backend.
 *
 * Wraps Axios calls to every API endpoint and exports strongly-typed
 * interfaces for request / response payloads.
 */

import axios from 'axios';

/** Base URL of the FastAPI backend. */
const API_URL = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

/** A single quantum gate in the circuit model. */
export interface QuantumGate {
    name: string;
    qubits: number[];
    params?: number[];
}

/** Result of a circuit execution (counts + optional statevector). */
export interface ExecutionResult {
    counts: Record<string, number>;
    statevector?: number[][]; // [[real, imag], ...]
    status: string;
    error?: string;
}

/** Result of circuit optimisation (depth / gate-count comparison). */
export interface OptimizationResult {
    original_depth: number;
    optimized_depth: number;
    original_ops: Record<string, number>;
    optimized_ops: Record<string, number>;
    optimized_qasm: string;
    improvement_msg: string;
    error?: string;
}

/** Result of a VQE / QAOA algorithm run. */
export interface AlgorithmResponse {
    status: string;
    optimal_energy?: number;
    optimal_params?: number[];
    history?: number[];
    message?: string;
    error?: string;
}

/** Result of a QFT simulation. */
export interface QFTResponse {
    counts?: Record<string, number>;
    statevector?: number[][];
    circuit_depth?: number;
    num_gates?: number;
    status: string;
    error?: string;
}

/** Full QAOA execution result with code export. */
export interface QAOAResponse {
    status: string;
    optimal_energy?: number;
    optimal_gammas?: number[];
    optimal_betas?: number[];
    optimal_params?: number[];
    history?: number[];
    counts?: Record<string, number>;
    probabilities?: number[];
    most_likely_state?: string;
    p_layers?: number;
    code?: Record<string, string>;
    message?: string;
    error?: string;
}

/** Full standalone VQE execution result with code export. */
export interface VQEResponse {
    status: string;
    optimal_energy?: number;
    optimal_params?: number[];
    history?: number[];
    counts?: Record<string, number>;
    probabilities?: number[];
    most_likely_state?: string;
    ansatz_depth?: number;
    code?: Record<string, string>;
    message?: string;
    error?: string;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

/**
 * Execute a quantum circuit and return measurement counts + statevector.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 * @param shots     Measurement repetitions (default 1024).
 */
export const executeCircuit = async (
    gates: QuantumGate[],
    numQubits: number,
    shots: number = 1024,
): Promise<ExecutionResult> => {
    try {
        const response = await axios.post(`${API_URL}/execute`, {
            gates,
            num_qubits: numQubits,
            shots,
        });
        return response.data;
    } catch (error) {
        console.error('Error executing circuit:', error);
        throw error;
    }
};

/**
 * Optimise the circuit via Qiskit's transpiler and return comparison metrics.
 *
 * @param gates     Ordered gate list.
 * @param numQubits Number of qubits.
 */
export const optimizeCircuit = async (
    gates: QuantumGate[],
    numQubits: number,
): Promise<OptimizationResult> => {
    try {
        const response = await axios.post(`${API_URL}/optimize`, {
            gates,
            num_qubits: numQubits,
        });
        return response.data;
    } catch (error) {
        console.error('Error optimizing circuit:', error);
        throw error;
    }
};

/**
 * Request LaTeX source code for the circuit.
 */
export const exportToLatex = async (
    gates: QuantumGate[],
    numQubits: number,
): Promise<{ latex: string }> => {
    const response = await axios.post(`${API_URL}/export/latex`, {
        gates,
        num_qubits: numQubits,
    });
    return response.data;
};

/**
 * Request a rendered PNG image of the circuit (Base64-encoded).
 */
export const exportToImage = async (
    gates: QuantumGate[],
    numQubits: number,
): Promise<{ image_base64: string }> => {
    const response = await axios.post(`${API_URL}/export/image`, {
        gates,
        num_qubits: numQubits,
    });
    return response.data;
};

/**
 * Request per-qubit Bloch sphere visualisations (Base64 PNGs).
 */
export const exportToBloch = async (
    gates: QuantumGate[],
    numQubits: number,
): Promise<{ bloch_images?: string[]; image_base64?: string }> => {
    const response = await axios.post(`${API_URL}/export/bloch`, {
        gates,
        num_qubits: numQubits,
    });
    return response.data;
};

/**
 * Run a variational quantum algorithm (VQE / QAOA).
 *
 * @param gates       Ansatz circuit gates.
 * @param numQubits   Number of qubits.
 * @param hamiltonian Hamiltonian expression string.
 * @param algorithm   ``"VQE"`` or ``"QAOA"``.
 * @param maxIter     Maximum optimiser iterations.
 * @param optimizer   SciPy optimiser name.
 */
export const runAlgorithm = async (
    gates: QuantumGate[],
    numQubits: number,
    hamiltonian: string,
    algorithm: string = 'VQE',
    maxIter: number = 50,
    optimizer: string = 'COBYLA',
): Promise<AlgorithmResponse> => {
    try {
        const response = await axios.post(`${API_URL}/run-algorithm`, {
            circuit: { gates, num_qubits: numQubits },
            hamiltonian,
            algorithm,
            max_iter: maxIter,
            optimizer,
        });
        return response.data;
    } catch (error) {
        console.error('Error running algorithm:', error);
        throw error;
    }
};

/**
 * Build and simulate a Quantum Fourier Transform circuit.
 *
 * @param numQubits    Number of qubits.
 * @param initialState Optional bitstring to initialise the register.
 * @param inverse      Whether to apply QFT† instead of QFT.
 * @param shots        Measurement repetitions (default 1024).
 */
export const runQFT = async (
    numQubits: number,
    initialState?: string,
    inverse: boolean = false,
    shots: number = 1024,
): Promise<QFTResponse> => {
    try {
        const response = await axios.post(`${API_URL}/qft`, {
            num_qubits: numQubits,
            initial_state: initialState || null,
            inverse,
            shots,
        });
        return response.data;
    } catch (error) {
        console.error('Error running QFT:', error);
        throw error;
    }
};

/**
 * Run a QAOA optimization with generalised Ising Hamiltonian.
 * H = Σ J_{ij} Z_i Z_j + Σ h_i Z_i
 *
 * @param numQubits         Number of qubits.
 * @param interactionMatrix Upper-triangular coupling matrix J_{ij}.
 * @param pLayers           Number of QAOA layers (default 1).
 * @param maxIter           Max optimizer iterations (default 100).
 * @param optimizer         SciPy optimizer (default COBYLA).
 * @param shots             Measurement shots (default 1024).
 * @param linearTerms       Optional single-qubit Z field h_i array.
 */
export const runQAOA = async (
    numQubits: number,
    interactionMatrix: number[][],
    pLayers: number = 1,
    maxIter: number = 100,
    optimizer: string = 'COBYLA',
    shots: number = 1024,
    linearTerms?: number[],
): Promise<QAOAResponse> => {
    try {
        const response = await axios.post(`${API_URL}/qaoa`, {
            num_qubits: numQubits,
            interaction_matrix: interactionMatrix,
            linear_terms: linearTerms || null,
            p_layers: pLayers,
            max_iter: maxIter,
            optimizer,
            shots,
        });
        return response.data;
    } catch (error) {
        console.error('Error running QAOA:', error);
        throw error;
    }
};

/**
 * Run a standalone VQE optimization with Hamiltonian bases/scales.
 *
 * @param numQubits        Number of qubits.
 * @param hamiltonianBases Pauli basis strings, e.g. ["ZZ", "ZI"].
 * @param hamiltonianScales Scale factors for each basis term.
 * @param ansatzDepth      Number of RY ansatz layers (default 1).
 * @param maxIter          Max optimizer iterations (default 100).
 * @param optimizer        SciPy optimizer (default COBYLA).
 * @param shots            Measurement shots (default 1024).
 */
export const runVQE = async (
    numQubits: number,
    hamiltonianBases: string[],
    hamiltonianScales: number[],
    ansatzDepth: number = 1,
    maxIter: number = 100,
    optimizer: string = 'COBYLA',
    shots: number = 1024,
): Promise<VQEResponse> => {
    try {
        const response = await axios.post(`${API_URL}/vqe`, {
            num_qubits: numQubits,
            hamiltonian_bases: hamiltonianBases,
            hamiltonian_scales: hamiltonianScales,
            ansatz_depth: ansatzDepth,
            max_iter: maxIter,
            optimizer,
            shots,
        });
        return response.data;
    } catch (error) {
        console.error('Error running VQE:', error);
        throw error;
    }
};
