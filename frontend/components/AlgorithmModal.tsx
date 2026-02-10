import React, { useState } from 'react';
import { QuantumGate, runQAOA, runVQE, QAOAResponse, VQEResponse } from '../utils/api';
import { X, Play, Loader2, Info, Code, Copy, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import clsx from 'clsx';

interface AlgorithmModalProps {
    isOpen: boolean;
    onClose: () => void;
    circuit: QuantumGate[];
    numQubits: number;
}

/* ═══════════════════════ QAOA PRESETS ═══════════════════════ */

interface QaoaPreset {
    label: string;
    desc: string;
    n: number;
    matrix: number[][];
    linear: number[];
}

const QAOA_PRESETS: Record<string, QaoaPreset> = {
    maxcut_triangle: {
        label: 'MaxCut — Triangle (3q)',
        desc: 'H = Σ -ZZ  on triangle edges',
        n: 3,
        matrix: [[0,-1,-1],[0,0,-1],[0,0,0]],
        linear: [0,0,0],
    },
    maxcut_k4: {
        label: 'MaxCut — K₄ Complete (4q)',
        desc: 'H = Σ -ZZ  on all 6 edges of K₄',
        n: 4,
        matrix: [[0,-1,-1,-1],[0,0,-1,-1],[0,0,0,-1],[0,0,0,0]],
        linear: [0,0,0,0],
    },
    ising_chain: {
        label: 'Ising Chain (4q)',
        desc: 'H = Σ -ZZ  nearest-neighbour chain',
        n: 4,
        matrix: [[0,-1,0,0],[0,0,-1,0],[0,0,0,-1],[0,0,0,0]],
        linear: [0,0,0,0],
    },
    mvc_triangle: {
        label: 'Vertex Cover — Triangle (3q)',
        desc: 'H = ¾(ZZ+Z+Z) − Z  per edge & vertex',
        n: 3,
        matrix: [[0,0.75,0.75],[0,0,0.75],[0,0,0]],
        linear: [0.5, 0.5, 0.5],
    },
    mvc_path4: {
        label: 'Vertex Cover — Path (4q)',
        desc: 'Path graph 0-1-2-3, edges {01,12,23}',
        n: 4,
        matrix: [[0,0.75,0,0],[0,0,0.75,0],[0,0,0,0.75],[0,0,0,0]],
        linear: [-0.25, 0.5, 0.5, -0.25],
    },
    maxcut_ring5: {
        label: 'MaxCut — Ring (5q)',
        desc: 'H = Σ -ZZ  on 5-qubit ring',
        n: 5,
        matrix: [[0,-1,0,0,-1],[0,0,-1,0,0],[0,0,0,-1,0],[0,0,0,0,-1],[0,0,0,0,0]],
        linear: [0,0,0,0,0],
    },
    custom_qaoa: {
        label: 'Custom',
        desc: 'Define your own J_{ij} and h_i',
        n: 0,
        matrix: [],
        linear: [],
    },
};

/* ═══════════════════════ VQE PRESETS ═══════════════════════ */

const VQE_PRESETS: Record<string, { label: string; desc: string; n: number; bases: string[]; scales: number[] }> = {
    zz_2q: {
        label: '−Z⊗Z (2 qubits)',
        desc: 'Simplest 2-qubit Ising coupling',
        n: 2, bases: ['ZZ'], scales: [-1.0],
    },
    zz_zi_2q: {
        label: '−Z⊗Z − Z⊗I (2 qubits)',
        desc: 'ZZ coupling + single-Z field',
        n: 2, bases: ['ZZ', 'ZI'], scales: [-1.0, -1.0],
    },
    heisenberg_2q: {
        label: 'Heisenberg XX+YY+ZZ (2q)',
        desc: 'Full isotropic Heisenberg interaction',
        n: 2, bases: ['XX', 'YY', 'ZZ'], scales: [1.0, 1.0, 1.0],
    },
    ising_3q: {
        label: 'Ising Chain (3 qubits)',
        desc: '−ZZI − IZZ nearest-neighbour',
        n: 3, bases: ['ZZI', 'IZZ'], scales: [-1.0, -1.0],
    },
    maxcut_4q: {
        label: 'MaxCut 4-vertex graph',
        desc: 'ZZ on 5 edges of a 4-vertex graph',
        n: 4,
        bases: ['ZZII', 'ZIZI', 'ZIIZ', 'IZZI', 'IIZZ'],
        scales: [1.0, 1.0, 1.0, 1.0, 1.0],
    },
    transverse_ising_3q: {
        label: 'Transverse-field Ising (3q)',
        desc: '−ZZI − IZZ + 0.5(XII + IXI + IIX)',
        n: 3,
        bases: ['ZZI', 'IZZ', 'XII', 'IXI', 'IIX'],
        scales: [-1.0, -1.0, 0.5, 0.5, 0.5],
    },
    custom_vqe: {
        label: 'Custom',
        desc: 'Define bases & scales manually',
        n: 0, bases: [], scales: [],
    },
};

const CODE_TABS = [
    { key: 'qiskit',    label: 'Qiskit' },
    { key: 'pennylane',  label: 'PennyLane' },
    { key: 'cirq',       label: 'Cirq' },
    { key: 'qsharp',     label: 'Q#' },
    { key: 'qasm',       label: 'QASM' },
];

export default function AlgorithmModal({ isOpen, onClose, circuit, numQubits }: AlgorithmModalProps) {
    /* ── algorithm toggle ── */
    const [algorithm, setAlgorithm] = useState<'VQE' | 'QAOA'>('QAOA');

    /* ── shared ── */
    const [maxIter, setMaxIter] = useState(100);
    const [optimizer, setOptimizer] = useState('COBYLA');
    const [shots, setShots] = useState(1024);

    /* ── QAOA ── */
    const [qaoaPreset, setQaoaPreset] = useState('maxcut_k4');
    const [qaoaQubits, setQaoaQubits] = useState(4);
    const [matrixStr, setMatrixStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.matrix));
    const [linearStr, setLinearStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.linear));
    const [pLayers, setPLayers] = useState(1);

    /* ── VQE ── */
    const [vqePreset, setVqePreset] = useState('zz_2q');
    const [vqeQubits, setVqeQubits] = useState(2);
    const [basesStr, setBasesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.bases));
    const [scalesStr, setScalesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.scales));
    const [ansatzDepth, setAnsatzDepth] = useState(1);

    /* ── results ── */
    const [isLoading, setIsLoading] = useState(false);
    const [qaoaResult, setQaoaResult] = useState<QAOAResponse | null>(null);
    const [vqeResult, setVqeResult] = useState<VQEResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* ── code export ── */
    const [codeTab, setCodeTab] = useState('qiskit');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    /* ── preset handlers ── */
    const handleQaoaPreset = (key: string) => {
        setQaoaPreset(key);
        const p = QAOA_PRESETS[key];
        if (key !== 'custom_qaoa' && p) {
            setQaoaQubits(p.n);
            setMatrixStr(JSON.stringify(p.matrix));
            setLinearStr(JSON.stringify(p.linear));
        }
    };
    const handleVqePreset = (key: string) => {
        setVqePreset(key);
        const p = VQE_PRESETS[key];
        if (key !== 'custom_vqe' && p) {
            setVqeQubits(p.n);
            setBasesStr(JSON.stringify(p.bases));
            setScalesStr(JSON.stringify(p.scales));
        }
    };

    /* ── run ── */
    const handleRun = async () => {
        setIsLoading(true); setError(null);
        setQaoaResult(null); setVqeResult(null);
        try {
            if (algorithm === 'QAOA') {
                let matrix: number[][], linear: number[];
                try { matrix = JSON.parse(matrixStr); } catch { setError('Invalid matrix JSON.'); setIsLoading(false); return; }
                try { linear = JSON.parse(linearStr); } catch { linear = new Array(qaoaQubits).fill(0); }
                const data = await runQAOA(qaoaQubits, matrix, pLayers, maxIter, optimizer, shots, linear);
                setQaoaResult(data);
            } else {
                let bases: string[], scales: number[];
                try { bases = JSON.parse(basesStr); scales = JSON.parse(scalesStr); }
                catch { setError('Invalid bases/scales JSON.'); setIsLoading(false); return; }
                if (bases.length !== scales.length) { setError('Bases and scales must be equal length.'); setIsLoading(false); return; }
                const data = await runVQE(vqeQubits, bases, scales, ansatzDepth, maxIter, optimizer, shots);
                setVqeResult(data);
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || err.message || 'Simulation error');
        } finally { setIsLoading(false); }
    };

    const activeResult = algorithm === 'QAOA' ? qaoaResult : vqeResult;
    const activeCode = activeResult?.code;
    const chartData = activeResult?.history?.map((v, i) => ({ iteration: i + 1, energy: v })) || [];
    const handleCopy = () => {
        if (activeCode?.[codeTab]) {
            navigator.clipboard.writeText(activeCode[codeTab]);
            setCopied(true); setTimeout(() => setCopied(false), 1500);
        }
    };

    const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500";
    const labelCls = "block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1";

    /* ── Has non-zero linear terms? ── */
    const hasLinearTerms = (() => {
        try { return JSON.parse(linearStr).some((v: number) => v !== 0); } catch { return false; }
    })();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden">

                {/* ═══════ LEFT: Config ═══════ */}
                <div className="w-full md:w-[360px] bg-gray-800 p-5 flex flex-col border-r border-gray-700 overflow-y-auto">
                    <h2 className="text-lg font-bold text-white mb-4">Algorithm Setup</h2>
                    <div className="space-y-3 flex-1">

                        {/* Algorithm toggle */}
                        <div>
                            <label className={labelCls}>Algorithm</label>
                            <div className="flex bg-gray-900 rounded-lg p-1">
                                {['QAOA', 'VQE'].map(a => (
                                    <button key={a} onClick={() => setAlgorithm(a as any)}
                                        className={clsx("flex-1 py-1.5 text-sm rounded-md transition-colors font-medium",
                                            algorithm === a ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white")}>
                                        {a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ─── QAOA config ─── */}
                        {algorithm === 'QAOA' && (<>
                            <div>
                                <label className={labelCls}>Problem Preset</label>
                                <select value={qaoaPreset} onChange={e => handleQaoaPreset(e.target.value)} className={inputCls}>
                                    {Object.entries(QAOA_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {qaoaPreset !== 'custom_qaoa' && (
                                    <p className="text-[10px] text-gray-500 mt-1">{QAOA_PRESETS[qaoaPreset]?.desc}</p>
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>Qubits</label>
                                <input type="number" value={qaoaQubits} onChange={e => setQaoaQubits(parseInt(e.target.value) || 2)}
                                    className={inputCls} min={2} max={10} />
                            </div>
                            <div>
                                <label className={labelCls}>Interaction Matrix J<sub>ij</sub> <span className="text-gray-600 normal-case">(ZZ coupling)</span></label>
                                <textarea value={matrixStr} onChange={e => { setMatrixStr(e.target.value); setQaoaPreset('custom_qaoa'); }}
                                    className={`${inputCls} h-16 text-xs font-mono resize-none`} />
                            </div>
                            <div>
                                <label className={labelCls}>Linear Terms h<sub>i</sub> <span className="text-gray-600 normal-case">(single-Z fields)</span></label>
                                <textarea value={linearStr} onChange={e => { setLinearStr(e.target.value); setQaoaPreset('custom_qaoa'); }}
                                    className={`${inputCls} h-10 text-xs font-mono resize-none`} placeholder='[0,0,0]' />
                                {hasLinearTerms && (
                                    <p className="text-[10px] text-yellow-400/80 mt-1">⚡ Has linear Z terms → general Ising / MVC mode</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Layers (p)</label>
                                    <input type="number" value={pLayers} onChange={e => setPLayers(parseInt(e.target.value) || 1)}
                                        className={inputCls} min={1} max={10} />
                                </div>
                                <div>
                                    <label className={labelCls}>Shots</label>
                                    <input type="number" value={shots} onChange={e => setShots(parseInt(e.target.value) || 1024)}
                                        className={inputCls} min={1} />
                                </div>
                            </div>
                            <div className="bg-purple-900/20 border border-purple-900/50 rounded-lg p-2 text-[10px] text-purple-200 leading-relaxed">
                                <div className="flex items-center gap-1 mb-0.5 font-semibold"><Info size={12} /> Hamiltonian</div>
                                <span className="font-mono text-purple-300">H = Σ J<sub>ij</sub> Z<sub>i</sub>Z<sub>j</sub> + Σ h<sub>i</sub> Z<sub>i</sub></span>
                                <br />Supports MaxCut, Ising, <strong>Vertex Cover</strong>, QUBO, portfolio optimisation.
                            </div>
                        </>)}

                        {/* ─── VQE config ─── */}
                        {algorithm === 'VQE' && (<>
                            <div>
                                <label className={labelCls}>Problem Preset</label>
                                <select value={vqePreset} onChange={e => handleVqePreset(e.target.value)} className={inputCls}>
                                    {Object.entries(VQE_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {vqePreset !== 'custom_vqe' && (
                                    <p className="text-[10px] text-gray-500 mt-1">{VQE_PRESETS[vqePreset]?.desc}</p>
                                )}
                            </div>
                            <div>
                                <label className={labelCls}>Qubits</label>
                                <input type="number" value={vqeQubits} onChange={e => setVqeQubits(parseInt(e.target.value) || 2)}
                                    className={inputCls} min={2} max={10} />
                            </div>
                            <div>
                                <label className={labelCls}>Hamiltonian Bases <span className="text-gray-600 normal-case">(Pauli strings)</span></label>
                                <textarea value={basesStr} onChange={e => { setBasesStr(e.target.value); setVqePreset('custom_vqe'); }}
                                    className={`${inputCls} h-14 text-xs font-mono resize-none`} placeholder='["ZZ","ZI"]' />
                            </div>
                            <div>
                                <label className={labelCls}>Hamiltonian Scales <span className="text-gray-600 normal-case">(coefficients)</span></label>
                                <textarea value={scalesStr} onChange={e => { setScalesStr(e.target.value); setVqePreset('custom_vqe'); }}
                                    className={`${inputCls} h-14 text-xs font-mono resize-none`} placeholder='[-1.0,-1.0]' />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Ansatz Depth</label>
                                    <input type="number" value={ansatzDepth} onChange={e => setAnsatzDepth(parseInt(e.target.value) || 1)}
                                        className={inputCls} min={1} max={10} />
                                </div>
                                <div>
                                    <label className={labelCls}>Shots</label>
                                    <input type="number" value={shots} onChange={e => setShots(parseInt(e.target.value) || 1024)}
                                        className={inputCls} min={1} />
                                </div>
                            </div>
                            <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-2 text-[10px] text-blue-200 leading-relaxed">
                                <div className="flex items-center gap-1 mb-0.5 font-semibold"><Info size={12} /> VQE</div>
                                RY ansatz + CX entanglement. Each basis string is a Pauli tensor product.
                                Supports Z, X, Y, I — enabling Ising, Heisenberg, transverse-field models.
                            </div>
                        </>)}

                        {/* Shared: optimizer + max iter */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelCls}>Optimizer</label>
                                <select value={optimizer} onChange={e => setOptimizer(e.target.value)} className={inputCls}>
                                    <option value="COBYLA">COBYLA</option>
                                    <option value="L-BFGS-B">L-BFGS-B</option>
                                    <option value="SLSQP">SLSQP</option>
                                    <option value="Nelder-Mead">Nelder-Mead</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>Max Iterations</label>
                                <input type="number" value={maxIter} onChange={e => setMaxIter(parseInt(e.target.value))}
                                    className={inputCls} min={1} max={1000} />
                            </div>
                        </div>
                    </div>

                    {/* Run button */}
                    <div className="mt-4 pt-3 border-t border-gray-700">
                        <button onClick={handleRun} disabled={isLoading}
                            className={clsx("w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all text-sm",
                                isLoading ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white shadow-lg shadow-purple-900/20")}>
                            {isLoading
                                ? <><Loader2 size={16} className="animate-spin" /> Optimizing…</>
                                : <><Play size={16} /> Run {algorithm}</>}
                        </button>
                    </div>
                </div>

                {/* ═══════ RIGHT: Results ═══════ */}
                <div className="flex-1 bg-gray-900 p-5 flex flex-col relative overflow-hidden">
                    <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"><X size={20} /></button>
                    <h2 className="text-lg font-bold text-white mb-4">{algorithm} Results</h2>

                    <div className="flex-1 overflow-y-auto space-y-4">
                        {error && <div className="text-red-400 bg-red-900/20 p-3 rounded-lg text-sm">{error}</div>}

                        {!activeResult && !isLoading && !error && (
                            <div className="text-gray-500 text-center py-16">
                                <p className="text-lg font-medium mb-1">Ready to Simulate</p>
                                <p className="text-sm">Configure parameters and click <strong>Run {algorithm}</strong>.</p>
                            </div>
                        )}

                        {isLoading && (
                            <div className="text-purple-400 flex flex-col items-center gap-3 py-16">
                                <Loader2 size={32} className="animate-spin" />
                                <p className="text-sm">Running {algorithm} optimization loop…</p>
                            </div>
                        )}

                        {activeResult && !isLoading && (<>
                            {/* Stat cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Optimal Energy</p>
                                    <p className="text-base font-bold text-green-400">{activeResult.optimal_energy?.toFixed(6)}</p>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Most Likely State</p>
                                    <p className="text-base font-bold text-cyan-400 font-mono">|{activeResult.most_likely_state}⟩</p>
                                </div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Iterations</p>
                                    <p className="text-base font-bold text-white">{activeResult.history?.length}</p>
                                </div>
                                {algorithm === 'QAOA' && qaoaResult && (
                                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-0.5">Layers</p>
                                        <p className="text-base font-bold text-purple-400">{qaoaResult.p_layers}</p>
                                    </div>
                                )}
                                {algorithm === 'VQE' && vqeResult && (
                                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-0.5">Ansatz Depth</p>
                                        <p className="text-base font-bold text-blue-400">{vqeResult.ansatz_depth}</p>
                                    </div>
                                )}
                            </div>

                            {/* QAOA γ/β */}
                            {algorithm === 'QAOA' && qaoaResult && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-1">Optimal γ (cost)</p>
                                        <p className="text-xs font-mono text-yellow-300">[{qaoaResult.optimal_gammas?.map(g => g.toFixed(4)).join(', ')}]</p>
                                    </div>
                                    <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-1">Optimal β (mixer)</p>
                                        <p className="text-xs font-mono text-orange-300">[{qaoaResult.optimal_betas?.map(b => b.toFixed(4)).join(', ')}]</p>
                                    </div>
                                </div>
                            )}
                            {/* VQE θ */}
                            {algorithm === 'VQE' && vqeResult && (
                                <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Optimal θ parameters</p>
                                    <p className="text-xs font-mono text-yellow-300 break-all">[{vqeResult.optimal_params?.map(p => p.toFixed(4)).join(', ')}]</p>
                                </div>
                            )}

                            {/* Convergence */}
                            <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                <p className="text-xs text-gray-400 mb-2 font-medium">Convergence</p>
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                            <XAxis dataKey="iteration" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6', fontSize: 12 }} />
                                            <Line type="monotone" dataKey="energy" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Counts */}
                            {activeResult.counts && (
                                <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                    <p className="text-xs text-gray-400 mb-2 font-medium">Measurement Counts (top states)</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(activeResult.counts)
                                            .sort(([, a], [, b]) => b - a).slice(0, 8)
                                            .map(([state, count]) => (
                                                <div key={state} className="bg-gray-800 rounded p-2 text-center border border-gray-700">
                                                    <p className="font-mono text-xs text-cyan-300">|{state}⟩</p>
                                                    <p className="text-sm font-bold text-white">{count}</p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Code export */}
                            {activeCode && (
                                <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1">
                                            <Code size={14} className="text-blue-400" />
                                            <p className="text-xs text-gray-400 font-medium">Generated Code</p>
                                        </div>
                                        <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors">
                                            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                            {copied ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                    <div className="flex gap-1 mb-2">
                                        {CODE_TABS.map(tab => (
                                            <button key={tab.key} onClick={() => setCodeTab(tab.key)}
                                                className={clsx("px-2 py-1 text-[10px] rounded transition-colors",
                                                    codeTab === tab.key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white")}>
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>
                                    <pre className="bg-black/60 p-3 rounded text-[10px] text-gray-300 overflow-auto max-h-[300px] font-mono leading-relaxed whitespace-pre-wrap">
                                        {activeCode[codeTab]}
                                    </pre>
                                </div>
                            )}
                        </>)}
                    </div>
                </div>
            </div>
        </div>
    );
}
