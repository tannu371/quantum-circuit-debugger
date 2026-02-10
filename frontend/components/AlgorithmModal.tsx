import React, { useState } from 'react';
import { runQAOA, runVQE, runQuantumWalk, QAOAResponse, VQEResponse, QuantumWalkResponse } from '../utils/api';
import { X, Play, Loader2, Info, Code, Copy, Check } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import clsx from 'clsx';
import GraphVisualization from './GraphVisualization';

interface AlgorithmModalProps {
    isOpen: boolean;
    onClose: () => void;
    circuit: any[];
    numQubits: number;
}

/* ═══════════════════════ QAOA PRESETS ═══════════════════════ */

interface QaoaPreset { label: string; desc: string; n: number; matrix: number[][]; linear: number[]; }

const QAOA_PRESETS: Record<string, QaoaPreset> = {
    maxcut_triangle: { label: 'MaxCut — Triangle (3q)', desc: 'H = Σ -ZZ  on triangle edges', n: 3,
        matrix: [[0,-1,-1],[0,0,-1],[0,0,0]], linear: [0,0,0] },
    maxcut_k4: { label: 'MaxCut — K₄ (4q)', desc: 'H = Σ -ZZ  on all 6 edges', n: 4,
        matrix: [[0,-1,-1,-1],[0,0,-1,-1],[0,0,0,-1],[0,0,0,0]], linear: [0,0,0,0] },
    ising_chain: { label: 'Ising Chain (4q)', desc: 'H = Σ -ZZ  nearest-neighbour', n: 4,
        matrix: [[0,-1,-1,-1],[0,0,-1,-1],[0,0,0,-1],[0,0,0,0]], linear: [0,0,0,0] },
    mvc_triangle: { label: 'Vertex Cover — △ (3q)', desc: 'H = ¾(ZZ+Z+Z) − Z per edge & vertex', n: 3,
        matrix: [[0,0.75,0.75],[0,0,0.75],[0,0,0]], linear: [0.5,0.5,0.5] },
    mvc_path4: { label: 'Vertex Cover — Path (4q)', desc: 'Path 0-1-2-3', n: 4,
        matrix: [[0,0.75,0,0],[0,0,0.75,0],[0,0,0,0.75],[0,0,0,0]], linear: [-0.25,0.5,0.5,-0.25] },
    maxcut_ring5: { label: 'MaxCut — Ring (5q)', desc: 'H = Σ -ZZ on 5-ring', n: 5,
        matrix: [[0,-1,0,0,-1],[0,0,-1,0,0],[0,0,0,-1,0],[0,0,0,0,-1],[0,0,0,0,0]], linear: [0,0,0,0,0] },
    custom_qaoa: { label: 'Custom', desc: 'Define J_{ij} & h_i', n: 0, matrix: [], linear: [] },
};

/* ═══════════════════════ VQE PRESETS ═══════════════════════ */

const VQE_PRESETS: Record<string, { label: string; desc: string; n: number; bases: string[]; scales: number[] }> = {
    zz_2q: { label: '−Z⊗Z (2q)', desc: 'Simplest 2-qubit Ising', n: 2, bases: ['ZZ'], scales: [-1.0] },
    zz_zi_2q: { label: '−Z⊗Z − Z⊗I (2q)', desc: 'ZZ + single-Z field', n: 2, bases: ['ZZ','ZI'], scales: [-1,-1] },
    heisenberg_2q: { label: 'Heisenberg XX+YY+ZZ (2q)', desc: 'Full isotropic', n: 2, bases: ['XX','YY','ZZ'], scales: [1,1,1] },
    ising_3q: { label: 'Ising Chain (3q)', desc: '−ZZI − IZZ', n: 3, bases: ['ZZI','IZZ'], scales: [-1,-1] },
    transverse_ising_3q: { label: 'Transverse-field Ising (3q)', desc: '−ZZI − IZZ + 0.5 X fields', n: 3,
        bases: ['ZZI','IZZ','XII','IXI','IIX'], scales: [-1,-1,0.5,0.5,0.5] },
    custom_vqe: { label: 'Custom', desc: 'Bases & scales', n: 0, bases: [], scales: [] },
};

interface VqeMaxcutPreset { label: string; desc: string; n: number; adj: number[][]; invert: boolean }
const VQE_MAXCUT_PRESETS: Record<string, VqeMaxcutPreset> = {
    book_4v: {
        label: 'Example (4v)',
        desc: 'Similarity matrix → inverted (1−A) for MaxCut',
        n: 4,
        adj: [[1,0,0,0],[0,1,0,1],[0,0,1,0],[0,1,0,1]],
        invert: true,
    },
    triangle_3v: {
        label: 'Triangle (3v)',
        desc: 'All-to-all 3-vertex graph',
        n: 3,
        adj: [[0,1,1],[1,0,1],[1,1,0]],
        invert: false,
    },
    path_4v: {
        label: 'Path (4v)',
        desc: 'Linear chain 0-1-2-3',
        n: 4,
        adj: [[0,1,0,0],[1,0,1,0],[0,1,0,1],[0,0,1,0]],
        invert: false,
    },
    k4_complete: {
        label: 'Complete K₄',
        desc: 'All 6 edges',
        n: 4,
        adj: [[0,1,1,1],[1,0,1,1],[1,1,0,1],[1,1,1,0]],
        invert: false,
    },
    custom_maxcut: { label: 'Custom', desc: 'Enter adjacency matrix', n: 0, adj: [], invert: false },
};

/* ═══════════════════════ WALK PRESETS ═══════════════════════ */

const WALK_PRESETS: Record<string, { label: string; desc: string; topology: string; n: number }> = {
    cycle_4:    { label: 'Cycle (4 vertices)',    desc: 'Ring graph — periodic boundary',     topology: 'cycle',    n: 4 },
    cycle_8:    { label: 'Cycle (8 vertices)',    desc: 'Larger ring — shows spreading',      topology: 'cycle',    n: 8 },
    path_4:     { label: 'Path (4 vertices)',     desc: 'Linear chain — reflecting ends',     topology: 'path',     n: 4 },
    path_8:     { label: 'Path (8 vertices)',     desc: 'Longer chain — boundary effects',    topology: 'path',     n: 8 },
    complete_4: { label: 'Complete K₄',           desc: 'All-to-all connections',             topology: 'complete', n: 4 },
    star_5:     { label: 'Star (5 vertices)',     desc: 'Central hub + 4 leaves',             topology: 'star',     n: 5 },
    grid_4:     { label: 'Grid (4 vertices)',     desc: '2×2 square lattice',                 topology: 'grid',     n: 4 },
    custom_walk:{ label: 'Custom',                desc: 'Custom adjacency matrix',            topology: 'custom',   n: 0 },
};

const CODE_TABS = [
    { key: 'qiskit',   label: 'Qiskit' },
    { key: 'pennylane', label: 'PennyLane' },
    { key: 'cirq',      label: 'Cirq' },
    { key: 'qsharp',    label: 'Q#' },
    { key: 'qasm',      label: 'QASM' },
];

const VERTEX_COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16',
    '#F97316','#6366F1','#14B8A6','#D946EF','#FB923C','#22D3EE','#A3E635','#F472B6'];

export default function AlgorithmModal({ isOpen, onClose, numQubits }: AlgorithmModalProps) {
    const [algorithm, setAlgorithm] = useState<'QAOA' | 'VQE' | 'Walk'>('QAOA');

    /* shared */
    const [maxIter, setMaxIter] = useState(100);
    const [optimizer, setOptimizer] = useState('COBYLA');
    const [shots, setShots] = useState(1024);

    /* QAOA */
    const [qaoaPreset, setQaoaPreset] = useState('maxcut_k4');
    const [qaoaQubits, setQaoaQubits] = useState(4);
    const [matrixStr, setMatrixStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.matrix));
    const [linearStr, setLinearStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.linear));
    const [pLayers, setPLayers] = useState(1);

    /* VQE */
    const [vqeMode, setVqeMode] = useState<'hamiltonian' | 'maxcut'>('hamiltonian');
    const [vqePreset, setVqePreset] = useState('zz_2q');
    const [vqeQubits, setVqeQubits] = useState(2);
    const [basesStr, setBasesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.bases));
    const [scalesStr, setScalesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.scales));
    const [ansatzDepth, setAnsatzDepth] = useState(1);
    const [vqeAdjStr, setVqeAdjStr] = useState(JSON.stringify(VQE_MAXCUT_PRESETS.book_4v.adj));
    const [vqeMaxcutPreset, setVqeMaxcutPreset] = useState('book_4v');
    const [vqeInvert, setVqeInvert] = useState(false);

    /* Walk */
    const [walkPreset, setWalkPreset] = useState('cycle_4');
    const [walkTopology, setWalkTopology] = useState('cycle');
    const [walkVertices, setWalkVertices] = useState(4);
    const [walkInitial, setWalkInitial] = useState(0);
    const [walkSteps, setWalkSteps] = useState(10);
    const [walkDt, setWalkDt] = useState(0.5);
    const [walkMatrixStr, setWalkMatrixStr] = useState('');

    /* results */
    const [isLoading, setIsLoading] = useState(false);
    const [qaoaResult, setQaoaResult] = useState<QAOAResponse | null>(null);
    const [vqeResult, setVqeResult] = useState<VQEResponse | null>(null);
    const [walkResult, setWalkResult] = useState<QuantumWalkResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* code */
    const [codeTab, setCodeTab] = useState('qiskit');
    const [copied, setCopied] = useState(false);

    /* walk chart step slider */
    const [walkTimeIdx, setWalkTimeIdx] = useState(0);

    if (!isOpen) return null;

    /* ── preset handlers ── */
    const handleQaoaPreset = (k: string) => { setQaoaPreset(k); const p = QAOA_PRESETS[k]; if (k !== 'custom_qaoa') { setQaoaQubits(p.n); setMatrixStr(JSON.stringify(p.matrix)); setLinearStr(JSON.stringify(p.linear)); } };
    const handleVqePreset = (k: string) => { setVqePreset(k); const p = VQE_PRESETS[k]; if (k !== 'custom_vqe') { setVqeQubits(p.n); setBasesStr(JSON.stringify(p.bases)); setScalesStr(JSON.stringify(p.scales)); } };
    const handleVqeMaxcutPreset = (k: string) => {
        setVqeMaxcutPreset(k);
        const p = VQE_MAXCUT_PRESETS[k];
        if (k !== 'custom_maxcut') { setVqeQubits(p.n); setVqeAdjStr(JSON.stringify(p.adj)); setVqeInvert(p.invert); }
    };
    const handleWalkPreset = (k: string) => { setWalkPreset(k); const p = WALK_PRESETS[k]; if (k !== 'custom_walk') { setWalkTopology(p.topology); setWalkVertices(p.n); setWalkInitial(0); setWalkMatrixStr(''); } };

    const handleRun = async () => {
        setIsLoading(true); setError(null);
        setQaoaResult(null); setVqeResult(null); setWalkResult(null);
        try {
            if (algorithm === 'QAOA') {
                let matrix: number[][], linear: number[];
                try { matrix = JSON.parse(matrixStr); } catch { setError('Invalid matrix JSON.'); setIsLoading(false); return; }
                try { linear = JSON.parse(linearStr); } catch { linear = new Array(qaoaQubits).fill(0); }
                setQaoaResult(await runQAOA(qaoaQubits, matrix, pLayers, maxIter, optimizer, shots, linear));
            } else if (algorithm === 'VQE') {
                if (vqeMode === 'maxcut') {
                    let adjMatrix: number[][];
                    try { adjMatrix = JSON.parse(vqeAdjStr); } catch { setError('Invalid adjacency matrix JSON.'); setIsLoading(false); return; }
                    setVqeResult(await runVQE(vqeQubits, [], [], ansatzDepth, maxIter, optimizer, shots, adjMatrix, 'maxcut', vqeInvert));
                } else {
                    let bases: string[], scales: number[];
                    try { bases = JSON.parse(basesStr); scales = JSON.parse(scalesStr); }
                    catch { setError('Invalid bases/scales.'); setIsLoading(false); return; }
                    if (!bases.length) { setError('Provide at least one Hamiltonian basis string.'); setIsLoading(false); return; }
                    if (bases.length !== scales.length) { setError('Bases and scales must be same length.'); setIsLoading(false); return; }
                    setVqeResult(await runVQE(vqeQubits, bases, scales, ansatzDepth, maxIter, optimizer, shots));
                }
            } else {
                let adjMatrix: number[][] | undefined;
                if (walkMatrixStr.trim()) { try { adjMatrix = JSON.parse(walkMatrixStr); } catch { setError('Invalid adjacency matrix.'); setIsLoading(false); return; } }
                const data = await runQuantumWalk(walkTopology, walkVertices, walkInitial, walkSteps, walkDt, shots, adjMatrix);
                setWalkResult(data);
                setWalkTimeIdx(data.num_steps || walkSteps);
            }
        } catch (err: any) { setError(err?.response?.data?.detail || err.message || 'Error'); }
        finally { setIsLoading(false); }
    };

    const activeResult = algorithm === 'QAOA' ? qaoaResult : algorithm === 'VQE' ? vqeResult : walkResult;
    const activeCode = activeResult?.code;
    const handleCopy = () => { if (activeCode?.[codeTab]) { navigator.clipboard.writeText(activeCode[codeTab]); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

    const hasLinear = (() => { try { return JSON.parse(linearStr).some((v: number) => v !== 0); } catch { return false; } })();
    const varHistory = (algorithm === 'QAOA' ? qaoaResult?.history : vqeResult?.history) || [];
    const chartData = varHistory.map((v, i) => ({ iteration: i + 1, energy: v }));

    const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500";
    const labelCls = "block text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1";

    /* Current walk snapshot for bar chart */
    const walkSnapshot = walkResult?.probability_evolution?.[walkTimeIdx];
    const walkBarData = walkSnapshot?.probabilities.map((p, i) => ({ vertex: `v${i}`, prob: parseFloat(p.toFixed(4)) })) || [];

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
                                {(['QAOA','VQE','Walk'] as const).map(a => (
                                    <button key={a} onClick={() => setAlgorithm(a)}
                                        className={clsx("flex-1 py-1.5 text-sm rounded-md transition-colors font-medium",
                                            algorithm === a ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white")}>
                                        {a === 'Walk' ? 'Q-Walk' : a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ─── QAOA ─── */}
                        {algorithm === 'QAOA' && (<>
                            <div>
                                <label className={labelCls}>Problem Preset</label>
                                <select value={qaoaPreset} onChange={e => handleQaoaPreset(e.target.value)} className={inputCls}>
                                    {Object.entries(QAOA_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {qaoaPreset !== 'custom_qaoa' && <p className="text-[10px] text-gray-500 mt-1">{QAOA_PRESETS[qaoaPreset]?.desc}</p>}
                            </div>
                            <div><label className={labelCls}>Qubits</label>
                                <input type="number" value={qaoaQubits} onChange={e => setQaoaQubits(+e.target.value||2)} className={inputCls} min={2} max={10}/></div>
                            <div><label className={labelCls}>J<sub>ij</sub> Matrix <span className="text-gray-600 normal-case">(ZZ)</span></label>
                                <textarea value={matrixStr} onChange={e => { setMatrixStr(e.target.value); setQaoaPreset('custom_qaoa'); }} className={`${inputCls} h-16 text-xs font-mono resize-none`}/></div>
                            <div><label className={labelCls}>h<sub>i</sub> Linear <span className="text-gray-600 normal-case">(Z)</span></label>
                                <textarea value={linearStr} onChange={e => { setLinearStr(e.target.value); setQaoaPreset('custom_qaoa'); }} className={`${inputCls} h-10 text-xs font-mono resize-none`}/>
                                {hasLinear && <p className="text-[10px] text-yellow-400/80 mt-1">⚡ General Ising / MVC mode</p>}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls}>Layers (p)</label><input type="number" value={pLayers} onChange={e => setPLayers(+e.target.value||1)} className={inputCls} min={1} max={10}/></div>
                                <div><label className={labelCls}>Shots</label><input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} min={1}/></div>
                            </div>
                        </>)}

                        {/* ─── VQE ─── */}
                        {algorithm === 'VQE' && (<>
                            {/* Mode toggle */}
                            <div>
                                <label className={labelCls}>Mode</label>
                                <div className="flex bg-gray-900 rounded-lg p-1">
                                    <button onClick={() => setVqeMode('hamiltonian')}
                                        className={clsx("flex-1 py-1.5 text-[11px] rounded-md transition-colors font-medium",
                                            vqeMode === 'hamiltonian' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}>
                                        Hamiltonian
                                    </button>
                                    <button onClick={() => setVqeMode('maxcut')}
                                        className={clsx("flex-1 py-1.5 text-[11px] rounded-md transition-colors font-medium",
                                            vqeMode === 'maxcut' ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white")}>
                                        MaxCut Graph
                                    </button>
                                </div>
                            </div>

                            {vqeMode === 'hamiltonian' ? (<>
                                <div>
                                    <label className={labelCls}>Problem Preset</label>
                                    <select value={vqePreset} onChange={e => handleVqePreset(e.target.value)} className={inputCls}>
                                        {Object.entries(VQE_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                    {vqePreset !== 'custom_vqe' && <p className="text-[10px] text-gray-500 mt-1">{VQE_PRESETS[vqePreset]?.desc}</p>}
                                </div>
                                <div><label className={labelCls}>Qubits</label><input type="number" value={vqeQubits} onChange={e => setVqeQubits(+e.target.value||2)} className={inputCls} min={2} max={10}/></div>
                                <div><label className={labelCls}>Bases <span className="text-gray-600 normal-case">(Pauli)</span></label>
                                    <textarea value={basesStr} onChange={e => { setBasesStr(e.target.value); setVqePreset('custom_vqe'); }} className={`${inputCls} h-14 text-xs font-mono resize-none`}/></div>
                                <div><label className={labelCls}>Scales <span className="text-gray-600 normal-case">(coeffs)</span></label>
                                    <textarea value={scalesStr} onChange={e => { setScalesStr(e.target.value); setVqePreset('custom_vqe'); }} className={`${inputCls} h-14 text-xs font-mono resize-none`}/></div>
                            </>) : (<>
                                <div>
                                    <label className={labelCls}>Graph Preset</label>
                                    <select value={vqeMaxcutPreset} onChange={e => handleVqeMaxcutPreset(e.target.value)} className={inputCls}>
                                        {Object.entries(VQE_MAXCUT_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                    {vqeMaxcutPreset !== 'custom_maxcut' && <p className="text-[10px] text-gray-500 mt-1">{VQE_MAXCUT_PRESETS[vqeMaxcutPreset]?.desc}</p>}
                                </div>
                                <div><label className={labelCls}>Vertices (Qubits)</label>
                                    <input type="number" value={vqeQubits} onChange={e => { setVqeQubits(+e.target.value||4); setVqeMaxcutPreset('custom_maxcut'); }} className={inputCls} min={2} max={10}/></div>
                                <div><label className={labelCls}>Adjacency Matrix</label>
                                    <textarea value={vqeAdjStr} onChange={e => { setVqeAdjStr(e.target.value); setVqeMaxcutPreset('custom_maxcut'); }}
                                        className={`${inputCls} h-20 text-xs font-mono resize-none`} placeholder='[[1,0,0,0],[0,1,0,1],[0,0,1,0],[0,1,0,1]]'/></div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={vqeInvert} onChange={e => setVqeInvert(e.target.checked)} id="vqe-invert"
                                        className="accent-blue-500"/>
                                    <label htmlFor="vqe-invert" className="text-[10px] text-gray-400">Invert adjacency (use distance matrix 1−A)</label>
                                </div>
                                <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-2 text-[10px] text-blue-200 leading-relaxed">
                                    <div className="flex items-center gap-1 mb-0.5 font-semibold"><Info size={12}/> MaxCut Clustering</div>
                                    Builds Z⊗Z Hamiltonian from the graph. Vertices in state |0⟩ → Cluster A,
                                    |1⟩ → Cluster B. Solution minimizes edges within clusters.
                                </div>
                            </>)}

                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls}>Ansatz Depth</label><input type="number" value={ansatzDepth} onChange={e => setAnsatzDepth(+e.target.value||1)} className={inputCls} min={1} max={10}/></div>
                                <div><label className={labelCls}>Shots</label><input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} min={1}/></div>
                            </div>
                        </>)}

                        {/* ─── Quantum Walk ─── */}
                        {algorithm === 'Walk' && (<>
                            <div>
                                <label className={labelCls}>Graph Topology</label>
                                <select value={walkPreset} onChange={e => handleWalkPreset(e.target.value)} className={inputCls}>
                                    {Object.entries(WALK_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {walkPreset !== 'custom_walk' && <p className="text-[10px] text-gray-500 mt-1">{WALK_PRESETS[walkPreset]?.desc}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls}>Vertices</label>
                                    <input type="number" value={walkVertices} onChange={e => { setWalkVertices(+e.target.value||4); setWalkPreset('custom_walk'); }}
                                        className={inputCls} min={2} max={16}/></div>
                                <div><label className={labelCls}>Start Vertex</label>
                                    <input type="number" value={walkInitial} onChange={e => setWalkInitial(+e.target.value||0)}
                                        className={inputCls} min={0} max={walkVertices-1}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls}>Time Steps</label>
                                    <input type="number" value={walkSteps} onChange={e => setWalkSteps(+e.target.value||10)}
                                        className={inputCls} min={1} max={50}/></div>
                                <div><label className={labelCls}>Δt</label>
                                    <input type="number" value={walkDt} onChange={e => setWalkDt(+e.target.value||0.5)}
                                        className={inputCls} min={0.1} max={2} step={0.1}/></div>
                            </div>
                            {walkPreset === 'custom_walk' && (
                                <div><label className={labelCls}>Adjacency Matrix <span className="text-gray-600 normal-case">(optional JSON)</span></label>
                                    <textarea value={walkMatrixStr} onChange={e => setWalkMatrixStr(e.target.value)}
                                        className={`${inputCls} h-16 text-xs font-mono resize-none`} placeholder='[[0,1,0],[1,0,1],[0,1,0]]'/></div>
                            )}
                            <div><label className={labelCls}>Shots</label>
                                <input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} min={1}/></div>
                            <div className="bg-cyan-900/20 border border-cyan-900/50 rounded-lg p-2 text-[10px] text-cyan-200 leading-relaxed">
                                <div className="flex items-center gap-1 mb-0.5 font-semibold"><Info size={12}/> CTQW</div>
                                <span className="font-mono text-cyan-300">U(t) = e<sup>−iAt</sup></span> where <strong>A</strong> is the adjacency matrix.
                                Tracks probability distribution over vertices at each time step.
                            </div>
                        </>)}

                        {/* Shared: optimizer (QAOA/VQE only) */}
                        {algorithm !== 'Walk' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls}>Optimizer</label>
                                    <select value={optimizer} onChange={e => setOptimizer(e.target.value)} className={inputCls}>
                                        <option value="COBYLA">COBYLA</option><option value="L-BFGS-B">L-BFGS-B</option>
                                        <option value="SLSQP">SLSQP</option><option value="Nelder-Mead">Nelder-Mead</option>
                                    </select></div>
                                <div><label className={labelCls}>Max Iterations</label>
                                    <input type="number" value={maxIter} onChange={e => setMaxIter(+e.target.value)} className={inputCls} min={1} max={1000}/></div>
                            </div>
                        )}
                    </div>

                    {/* Run button */}
                    <div className="mt-4 pt-3 border-t border-gray-700">
                        <button onClick={handleRun} disabled={isLoading}
                            className={clsx("w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all text-sm",
                                isLoading ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                    : algorithm === 'Walk'
                                        ? "bg-gradient-to-r from-cyan-600 to-teal-600 hover:opacity-90 text-white shadow-lg shadow-cyan-900/20"
                                        : "bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white shadow-lg shadow-purple-900/20")}>
                            {isLoading ? <><Loader2 size={16} className="animate-spin"/> Running…</>
                                : <><Play size={16}/> Run {algorithm === 'Walk' ? 'Quantum Walk' : algorithm}</>}
                        </button>
                    </div>
                </div>

                {/* ═══════ RIGHT: Results ═══════ */}
                <div className="flex-1 bg-gray-900 p-5 flex flex-col relative overflow-hidden">
                    <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white z-10"><X size={20}/></button>
                    <h2 className="text-lg font-bold text-white mb-4">{algorithm === 'Walk' ? 'Quantum Walk' : algorithm} Results</h2>
                    <div className="flex-1 overflow-y-auto space-y-4">

                        {error && <div className="text-red-400 bg-red-900/20 p-3 rounded-lg text-sm">{error}</div>}

                        {!activeResult && !isLoading && !error && (
                            <div className="text-gray-500 text-center py-16">
                                <p className="text-lg font-medium mb-1">Ready to Simulate</p>
                                <p className="text-sm">Configure and click <strong>Run</strong>.</p></div>
                        )}
                        {isLoading && (
                            <div className="text-purple-400 flex flex-col items-center gap-3 py-16">
                                <Loader2 size={32} className="animate-spin"/><p className="text-sm">Running simulation…</p></div>
                        )}

                        {/* ═══ QAOA / VQE results ═══ */}
                        {(algorithm === 'QAOA' || algorithm === 'VQE') && activeResult && !isLoading && (<>
                            {/* stat cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Optimal Energy</p>
                                    <p className="text-base font-bold text-green-400">{(activeResult as any).optimal_energy?.toFixed(6)}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Most Likely</p>
                                    <p className="text-base font-bold text-cyan-400 font-mono">|{(activeResult as any).most_likely_state}⟩</p></div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Iterations</p>
                                    <p className="text-base font-bold text-white">{varHistory.length}</p></div>
                                {algorithm === 'QAOA' && qaoaResult && (
                                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-0.5">Layers</p>
                                        <p className="text-base font-bold text-purple-400">{qaoaResult.p_layers}</p></div>
                                )}
                                {algorithm === 'VQE' && vqeResult && (
                                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-0.5">Depth</p>
                                        <p className="text-base font-bold text-blue-400">{vqeResult.ansatz_depth}</p></div>
                                )}
                            </div>

                            {/* ═══ Hamiltonian Terms (VQE) ═══ */}
                            {algorithm === 'VQE' && vqeResult && vqeResult.hamiltonian_bases && vqeResult.hamiltonian_bases.length > 0 && (
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-2">Hamiltonian Terms ({vqeResult.hamiltonian_bases.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                        {vqeResult.hamiltonian_bases.map((b, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 bg-gray-900 rounded px-2 py-1 text-xs border border-gray-700">
                                                <span className="text-purple-400 font-mono font-bold">{b}</span>
                                                <span className="text-gray-500">×</span>
                                                <span className="text-cyan-400 font-mono">{vqeResult.hamiltonian_scales?.[i]?.toFixed(2)}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ═══ Graph Visualization (QAOA) ═══ */}
                            {algorithm === 'QAOA' && qaoaResult && (() => {
                                let adjMatrix: number[][] = [];
                                try { adjMatrix = JSON.parse(matrixStr); } catch {}
                                if (adjMatrix.length > 0) {
                                    // Make adjacency symmetric for display
                                    const n = adjMatrix.length;
                                    const symAdj = adjMatrix.map(r => [...r]);
                                    for (let i = 0; i < n; i++)
                                        for (let j = i + 1; j < n; j++) {
                                            const v = symAdj[i][j] || symAdj[j][i];
                                            symAdj[i][j] = v; symAdj[j][i] = v;
                                        }
                                    return (
                                        <GraphVisualization
                                            adjacencyMatrix={symAdj}
                                            solutionBitstring={qaoaResult.most_likely_state}
                                            title={`Solution Graph — |${qaoaResult.most_likely_state}⟩`}
                                            cluster0Label="Set A"
                                            cluster1Label="Set B"
                                        />
                                    );
                                }
                                return null;
                            })()}

                            {/* ═══ Graph Visualization (VQE MaxCut) ═══ */}
                            {algorithm === 'VQE' && vqeResult && vqeMode === 'maxcut' && (() => {
                                let adjMatrix: number[][] = [];
                                try { adjMatrix = JSON.parse(vqeAdjStr); } catch {}
                                if (adjMatrix.length > 0) {
                                    // If inverted, show the distance matrix (1−A, diagonal 0)
                                    const displayMatrix = vqeInvert
                                        ? adjMatrix.map((row, i) => row.map((v, j) => i === j ? 0 : 1 - v))
                                        : adjMatrix;
                                    return (
                                        <GraphVisualization
                                            adjacencyMatrix={displayMatrix}
                                            solutionBitstring={vqeResult.most_likely_state}
                                            title={`MaxCut Solution${vqeInvert ? ' (inverted)' : ''} — |${vqeResult.most_likely_state}⟩`}
                                            cluster0Label="Cluster A"
                                            cluster1Label="Cluster B"
                                        />
                                    );
                                }
                                return null;
                            })()}

                            {/* γ/β or θ */}
                            {algorithm === 'QAOA' && qaoaResult && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-1">γ (cost)</p>
                                        <p className="text-xs font-mono text-yellow-300">[{qaoaResult.optimal_gammas?.map(g => g.toFixed(4)).join(', ')}]</p></div>
                                    <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                        <p className="text-[10px] text-gray-500 uppercase mb-1">β (mixer)</p>
                                        <p className="text-xs font-mono text-orange-300">[{qaoaResult.optimal_betas?.map(b => b.toFixed(4)).join(', ')}]</p></div>
                                </div>
                            )}
                            {algorithm === 'VQE' && vqeResult && (
                                <div className="bg-gray-800 rounded p-2 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-1">Optimal θ</p>
                                    <p className="text-xs font-mono text-yellow-300 break-all">[{vqeResult.optimal_params?.map(p => p.toFixed(4)).join(', ')}]</p></div>
                            )}

                            {/* convergence */}
                            <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                <p className="text-xs text-gray-400 mb-2 font-medium">Convergence</p>
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                                            <XAxis dataKey="iteration" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false}/>
                                            <Tooltip contentStyle={{ backgroundColor:'#1F2937', borderColor:'#374151', color:'#F3F4F6', fontSize:12 }}/>
                                            <Line type="monotone" dataKey="energy" stroke="#8B5CF6" strokeWidth={2} dot={false}/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* counts */}
                            {(activeResult as any).counts && (
                                <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                    <p className="text-xs text-gray-400 mb-2 font-medium">Measurement Counts</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries((activeResult as any).counts as Record<string,number>)
                                            .sort(([,a],[,b]) => b - a).slice(0,8)
                                            .map(([s,c]) => (
                                                <div key={s} className="bg-gray-800 rounded p-2 text-center border border-gray-700">
                                                    <p className="font-mono text-xs text-cyan-300">|{s}⟩</p>
                                                    <p className="text-sm font-bold text-white">{c}</p></div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ Quantum Walk results ═══ */}
                        {algorithm === 'Walk' && walkResult && !isLoading && (<>
                            {/* stat cards */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Vertices</p>
                                    <p className="text-base font-bold text-cyan-400">{walkResult.num_vertices}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Qubits</p>
                                    <p className="text-base font-bold text-purple-400">{walkResult.num_qubits}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">Most Likely</p>
                                    <p className="text-base font-bold text-green-400">v{walkResult.most_likely_vertex}</p></div>
                                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                                    <p className="text-[10px] text-gray-500 uppercase mb-0.5">t final</p>
                                    <p className="text-base font-bold text-yellow-400">{((walkResult.num_steps||0) * (walkResult.dt||0)).toFixed(1)}</p></div>
                            </div>

                            {/* ═══ Graph Visualization (Walk) ═══ */}
                            {(() => {
                                // Build adjacency for walk
                                let walkAdj: number[][] = [];
                                if (walkMatrixStr.trim()) {
                                    try { walkAdj = JSON.parse(walkMatrixStr); } catch {}
                                } else {
                                    // Reconstruct from topology
                                    const nv = walkResult.num_vertices || walkVertices;
                                    walkAdj = Array.from({length: nv}, () => Array(nv).fill(0));
                                    if (walkTopology === 'cycle') {
                                        for (let i = 0; i < nv; i++) { walkAdj[i][(i+1)%nv] = 1; walkAdj[(i+1)%nv][i] = 1; }
                                    } else if (walkTopology === 'path') {
                                        for (let i = 0; i < nv-1; i++) { walkAdj[i][i+1] = 1; walkAdj[i+1][i] = 1; }
                                    } else if (walkTopology === 'complete') {
                                        for (let i = 0; i < nv; i++) for (let j = i+1; j < nv; j++) { walkAdj[i][j] = 1; walkAdj[j][i] = 1; }
                                    } else if (walkTopology === 'star') {
                                        for (let i = 1; i < nv; i++) { walkAdj[0][i] = 1; walkAdj[i][0] = 1; }
                                    } else if (walkTopology === 'grid') {
                                        const side = Math.ceil(Math.sqrt(nv));
                                        for (let i = 0; i < nv; i++) {
                                            const c = i % side;
                                            if (c + 1 < side && i + 1 < nv) { walkAdj[i][i+1] = 1; walkAdj[i+1][i] = 1; }
                                            if (i + side < nv) { walkAdj[i][i+side] = 1; walkAdj[i+side][i] = 1; }
                                        }
                                    }
                                }
                                if (walkAdj.length > 0) {
                                    const snapProbs = walkSnapshot?.probabilities || [];
                                    return (
                                        <GraphVisualization
                                            adjacencyMatrix={walkAdj}
                                            probabilities={snapProbs}
                                            title={`Walk Graph — t = ${walkSnapshot?.time?.toFixed(2) ?? '0'}`}
                                        />
                                    );
                                }
                                return null;
                            })()}

                            {/* Probability distribution at current time */}
                            <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-gray-400 font-medium">
                                        Probability Distribution — t = {walkSnapshot?.time?.toFixed(2) ?? '0'}
                                    </p>
                                </div>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={walkBarData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                                            <XAxis dataKey="vertex" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]}/>
                                            <Tooltip contentStyle={{ backgroundColor:'#1F2937', borderColor:'#374151', color:'#F3F4F6', fontSize:12 }}/>
                                            <Bar dataKey="prob" radius={[4,4,0,0]}>
                                                {walkBarData.map((_, i) => <Cell key={i} fill={VERTEX_COLORS[i % VERTEX_COLORS.length]}/>)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                {/* Time slider */}
                                <div className="mt-2 flex items-center gap-3">
                                    <span className="text-[10px] text-gray-500 w-8">t=0</span>
                                    <input type="range" min={0} max={walkResult.num_steps || walkSteps}
                                        value={walkTimeIdx} onChange={e => setWalkTimeIdx(+e.target.value)}
                                        className="flex-1 accent-cyan-500 h-1"/>
                                    <span className="text-[10px] text-gray-500 w-12 text-right">
                                        t={((walkResult.num_steps||0) * (walkResult.dt||0)).toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            {/* Probability evolution over time (line chart) */}
                            <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                <p className="text-xs text-gray-400 mb-2 font-medium">Probability Evolution</p>
                                <div className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={walkResult.probability_evolution?.map(snap => {
                                            const d: any = { time: snap.time };
                                            snap.probabilities.forEach((p, i) => { d[`v${i}`] = parseFloat(p.toFixed(4)); });
                                            return d;
                                        }) || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#374151"/>
                                            <XAxis dataKey="time" stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]}/>
                                            <Tooltip contentStyle={{ backgroundColor:'#1F2937', borderColor:'#374151', color:'#F3F4F6', fontSize:11 }}/>
                                            {Array.from({ length: walkResult.num_vertices || 0 }, (_, i) => (
                                                <Line key={i} type="monotone" dataKey={`v${i}`}
                                                    stroke={VERTEX_COLORS[i % VERTEX_COLORS.length]} strokeWidth={2} dot={false}/>
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {Array.from({ length: walkResult.num_vertices || 0 }, (_, i) => (
                                        <span key={i} className="text-[10px] flex items-center gap-1">
                                            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: VERTEX_COLORS[i % VERTEX_COLORS.length] }}/>
                                            v{i}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Final counts */}
                            {walkResult.final_counts && (
                                <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                    <p className="text-xs text-gray-400 mb-2 font-medium">Final Measurement Counts</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(walkResult.final_counts)
                                            .sort(([,a],[,b]) => b - a).slice(0,8)
                                            .map(([s,c]) => (
                                                <div key={s} className="bg-gray-800 rounded p-2 text-center border border-gray-700">
                                                    <p className="font-mono text-xs text-cyan-300">v{parseInt(s,2)}</p>
                                                    <p className="text-sm font-bold text-white">{c}</p></div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ Code export (all algorithms) ═══ */}
                        {activeCode && !isLoading && (
                            <div className="bg-gray-950/50 rounded-lg border border-gray-800 p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1">
                                        <Code size={14} className="text-blue-400"/><p className="text-xs text-gray-400 font-medium">Generated Code</p></div>
                                    <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors">
                                        {copied ? <Check size={12} className="text-green-400"/> : <Copy size={12}/>}
                                        {copied ? 'Copied!' : 'Copy'}</button>
                                </div>
                                <div className="flex gap-1 mb-2">
                                    {CODE_TABS.map(t => (
                                        <button key={t.key} onClick={() => setCodeTab(t.key)}
                                            className={clsx("px-2 py-1 text-[10px] rounded transition-colors",
                                                codeTab === t.key ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white")}>
                                            {t.label}</button>
                                    ))}
                                </div>
                                <pre className="bg-black/60 p-3 rounded text-[10px] text-gray-300 overflow-auto max-h-[300px] font-mono leading-relaxed whitespace-pre-wrap">
                                    {activeCode[codeTab]}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
