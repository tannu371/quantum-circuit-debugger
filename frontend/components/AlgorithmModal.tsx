import React, { useState } from 'react';
import { runQAOA, runVQE, runQuantumWalk, QAOAResponse, VQEResponse, QuantumWalkResponse } from '../utils/api';
import { X, Play, Loader2, Info, Code, Copy, Check, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import clsx from 'clsx';
import GraphVisualization from './GraphVisualization';
import HighLevelCircuitDiagram from './HighLevelCircuitDiagram';

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
    book_4v: { label: 'Example (4v)', desc: 'Similarity matrix → inverted (1−A) for MaxCut', n: 4,
        adj: [[1,0,0,0],[0,1,0,1],[0,0,1,0],[0,1,0,1]], invert: true },
    triangle_3v: { label: 'Triangle (3v)', desc: 'All-to-all 3-vertex graph', n: 3,
        adj: [[0,1,1],[1,0,1],[1,1,0]], invert: false },
    path_4v: { label: 'Path (4v)', desc: 'Linear chain 0-1-2-3', n: 4,
        adj: [[0,1,0,0],[1,0,1,0],[0,1,0,1],[0,0,1,0]], invert: false },
    k4_complete: { label: 'Complete K₄', desc: 'All 6 edges', n: 4,
        adj: [[0,1,1,1],[1,0,1,1],[1,1,0,1],[1,1,1,0]], invert: false },
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
    const [maxIter, setMaxIter] = useState(100);
    const [optimizer, setOptimizer] = useState('COBYLA');
    const [shots, setShots] = useState(1024);
    const [qaoaPreset, setQaoaPreset] = useState('maxcut_k4');
    const [qaoaQubits, setQaoaQubits] = useState(4);
    const [matrixStr, setMatrixStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.matrix));
    const [linearStr, setLinearStr] = useState(JSON.stringify(QAOA_PRESETS.maxcut_k4.linear));
    const [pLayers, setPLayers] = useState(1);
    const [vqeMode, setVqeMode] = useState<'hamiltonian' | 'maxcut'>('hamiltonian');
    const [vqePreset, setVqePreset] = useState('zz_2q');
    const [vqeQubits, setVqeQubits] = useState(2);
    const [basesStr, setBasesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.bases));
    const [scalesStr, setScalesStr] = useState(JSON.stringify(VQE_PRESETS.zz_2q.scales));
    const [ansatzDepth, setAnsatzDepth] = useState(1);
    const [vqeAdjStr, setVqeAdjStr] = useState(JSON.stringify(VQE_MAXCUT_PRESETS.book_4v.adj));
    const [vqeMaxcutPreset, setVqeMaxcutPreset] = useState('book_4v');
    const [vqeInvert, setVqeInvert] = useState(false);
    const [walkPreset, setWalkPreset] = useState('cycle_4');
    const [walkTopology, setWalkTopology] = useState('cycle');
    const [walkVertices, setWalkVertices] = useState(4);
    const [walkInitial, setWalkInitial] = useState(0);
    const [walkSteps, setWalkSteps] = useState(10);
    const [walkDt, setWalkDt] = useState(0.5);
    const [walkMatrixStr, setWalkMatrixStr] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [qaoaResult, setQaoaResult] = useState<QAOAResponse | null>(null);
    const [vqeResult, setVqeResult] = useState<VQEResponse | null>(null);
    const [walkResult, setWalkResult] = useState<QuantumWalkResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [codeTab, setCodeTab] = useState('qiskit');
    const [copied, setCopied] = useState(false);
    const [walkTimeIdx, setWalkTimeIdx] = useState(0);
    const [circuitView, setCircuitView] = useState<'highlevel' | 'qiskit'>('highlevel');

    if (!isOpen) return null;

    const handleQaoaPreset = (k: string) => { setQaoaPreset(k); const p = QAOA_PRESETS[k]; if (k !== 'custom_qaoa') { setQaoaQubits(p.n); setMatrixStr(JSON.stringify(p.matrix)); setLinearStr(JSON.stringify(p.linear)); } };
    const handleVqePreset = (k: string) => { setVqePreset(k); const p = VQE_PRESETS[k]; if (k !== 'custom_vqe') { setVqeQubits(p.n); setBasesStr(JSON.stringify(p.bases)); setScalesStr(JSON.stringify(p.scales)); } };
    const handleVqeMaxcutPreset = (k: string) => { setVqeMaxcutPreset(k); const p = VQE_MAXCUT_PRESETS[k]; if (k !== 'custom_maxcut') { setVqeQubits(p.n); setVqeAdjStr(JSON.stringify(p.adj)); setVqeInvert(p.invert); } };
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

    const inputCls = "w-full rounded-lg p-2 text-sm focus:outline-none transition-colors";
    const inputStyle: React.CSSProperties = { background: 'var(--bg-input)', border: '1px solid var(--border-secondary)', color: 'var(--text-primary)' };
    const labelCls = "block text-[10px] font-medium uppercase tracking-wider mb-1";
    const labelStyle: React.CSSProperties = { color: 'var(--text-muted)' };
    const cardStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)' };

    const walkSnapshot = walkResult?.probability_evolution?.[walkTimeIdx];
    const walkBarData = walkSnapshot?.probabilities.map((p, i) => ({ vertex: `v${i}`, prob: parseFloat(p.toFixed(4)) })) || [];

    const downloadChartAsPng = (containerId: string, filename: string) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const svg = container.querySelector('svg');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width * 2;
            canvas.height = img.height * 2;
            ctx.scale(2, 2);
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            const a = document.createElement('a');
            a.download = `${filename}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    const downloadBase64Image = (base64: string, filename: string) => {
        const a = document.createElement('a');
        a.download = `${filename}.png`;
        a.href = `data:image/png;base64,${base64}`;
        a.click();
    };

    const SaveBtn = ({ onClick, label }: { onClick: () => void; label?: string }) => (
        <button onClick={onClick} className="flex items-center gap-1 text-[10px] transition-colors hover:opacity-80" style={{ color: 'var(--text-muted)' }}>
            <Download size={12}/> {label || 'Save'}
        </button>
    );

    return (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4" style={{ background: 'var(--bg-overlay)' }}>
            <div className="rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)' }}>

                {/* LEFT: Config */}
                <div className="w-full md:w-[360px] p-4 md:p-5 flex flex-col overflow-y-auto max-h-[40vh] md:max-h-none" style={{ background: 'var(--bg-tertiary)', borderRight: '1px solid var(--border-secondary)' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Algorithm Setup</h2>
                    <div className="space-y-3 flex-1">
                        {/* Algorithm toggle */}
                        <div>
                            <label className={labelCls} style={labelStyle}>Algorithm</label>
                            <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-input)' }}>
                                {(['QAOA','VQE','Walk'] as const).map(a => (
                                    <button key={a} onClick={() => setAlgorithm(a)}
                                        className={clsx("flex-1 py-1.5 text-sm rounded-md transition-colors font-medium")}
                                        style={{ background: algorithm === a ? 'var(--accent-secondary)' : 'transparent', color: algorithm === a ? 'white' : 'var(--text-muted)' }}>
                                        {a === 'Walk' ? 'Q-Walk' : a}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* QAOA */}
                        {algorithm === 'QAOA' && (<>
                            <div>
                                <label className={labelCls} style={labelStyle}>Problem Preset</label>
                                <select value={qaoaPreset} onChange={e => handleQaoaPreset(e.target.value)} className={inputCls} style={inputStyle}>
                                    {Object.entries(QAOA_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {qaoaPreset !== 'custom_qaoa' && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{QAOA_PRESETS[qaoaPreset]?.desc}</p>}
                            </div>
                            <div><label className={labelCls} style={labelStyle}>Qubits</label>
                                <input type="number" value={qaoaQubits} onChange={e => setQaoaQubits(+e.target.value||2)} className={inputCls} style={inputStyle} min={2} max={10}/></div>
                            <div><label className={labelCls} style={labelStyle}>J<sub>ij</sub> Matrix <span style={{ color: 'var(--text-muted)' }}>(ZZ)</span></label>
                                <textarea value={matrixStr} onChange={e => { setMatrixStr(e.target.value); setQaoaPreset('custom_qaoa'); }} className={`${inputCls} h-16 text-xs font-mono resize-none`} style={inputStyle}/></div>
                            <div><label className={labelCls} style={labelStyle}>h<sub>i</sub> Linear <span style={{ color: 'var(--text-muted)' }}>(Z)</span></label>
                                <textarea value={linearStr} onChange={e => { setLinearStr(e.target.value); setQaoaPreset('custom_qaoa'); }} className={`${inputCls} h-10 text-xs font-mono resize-none`} style={inputStyle}/>
                                {hasLinear && <p className="text-[10px] mt-1" style={{ color: 'var(--accent-yellow)' }}>⚡ General Ising / MVC mode</p>}</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls} style={labelStyle}>Layers (p)</label><input type="number" value={pLayers} onChange={e => setPLayers(+e.target.value||1)} className={inputCls} style={inputStyle} min={1} max={10}/></div>
                                <div><label className={labelCls} style={labelStyle}>Shots</label><input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} style={inputStyle} min={1}/></div>
                            </div>
                        </>)}

                        {/* VQE */}
                        {algorithm === 'VQE' && (<>
                            <div>
                                <label className={labelCls} style={labelStyle}>Mode</label>
                                <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-input)' }}>
                                    <button onClick={() => setVqeMode('hamiltonian')}
                                        className="flex-1 py-1.5 text-[11px] rounded-md transition-colors font-medium"
                                        style={{ background: vqeMode === 'hamiltonian' ? 'var(--accent-blue)' : 'transparent', color: vqeMode === 'hamiltonian' ? 'white' : 'var(--text-muted)' }}>
                                        Hamiltonian
                                    </button>
                                    <button onClick={() => setVqeMode('maxcut')}
                                        className="flex-1 py-1.5 text-[11px] rounded-md transition-colors font-medium"
                                        style={{ background: vqeMode === 'maxcut' ? 'var(--accent-blue)' : 'transparent', color: vqeMode === 'maxcut' ? 'white' : 'var(--text-muted)' }}>
                                        MaxCut Graph
                                    </button>
                                </div>
                            </div>

                            {vqeMode === 'hamiltonian' ? (<>
                                <div>
                                    <label className={labelCls} style={labelStyle}>Problem Preset</label>
                                    <select value={vqePreset} onChange={e => handleVqePreset(e.target.value)} className={inputCls} style={inputStyle}>
                                        {Object.entries(VQE_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                    {vqePreset !== 'custom_vqe' && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{VQE_PRESETS[vqePreset]?.desc}</p>}
                                </div>
                                <div><label className={labelCls} style={labelStyle}>Qubits</label><input type="number" value={vqeQubits} onChange={e => setVqeQubits(+e.target.value||2)} className={inputCls} style={inputStyle} min={2} max={10}/></div>
                                <div><label className={labelCls} style={labelStyle}>Bases <span style={{ color: 'var(--text-muted)' }}>(Pauli)</span></label>
                                    <textarea value={basesStr} onChange={e => { setBasesStr(e.target.value); setVqePreset('custom_vqe'); }} className={`${inputCls} h-14 text-xs font-mono resize-none`} style={inputStyle}/></div>
                                <div><label className={labelCls} style={labelStyle}>Scales <span style={{ color: 'var(--text-muted)' }}>(coeffs)</span></label>
                                    <textarea value={scalesStr} onChange={e => { setScalesStr(e.target.value); setVqePreset('custom_vqe'); }} className={`${inputCls} h-14 text-xs font-mono resize-none`} style={inputStyle}/></div>
                            </>) : (<>
                                <div>
                                    <label className={labelCls} style={labelStyle}>Graph Preset</label>
                                    <select value={vqeMaxcutPreset} onChange={e => handleVqeMaxcutPreset(e.target.value)} className={inputCls} style={inputStyle}>
                                        {Object.entries(VQE_MAXCUT_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                    </select>
                                    {vqeMaxcutPreset !== 'custom_maxcut' && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{VQE_MAXCUT_PRESETS[vqeMaxcutPreset]?.desc}</p>}
                                </div>
                                <div><label className={labelCls} style={labelStyle}>Vertices (Qubits)</label>
                                    <input type="number" value={vqeQubits} onChange={e => { setVqeQubits(+e.target.value||4); setVqeMaxcutPreset('custom_maxcut'); }} className={inputCls} style={inputStyle} min={2} max={10}/></div>
                                <div><label className={labelCls} style={labelStyle}>Adjacency Matrix</label>
                                    <textarea value={vqeAdjStr} onChange={e => { setVqeAdjStr(e.target.value); setVqeMaxcutPreset('custom_maxcut'); }}
                                        className={`${inputCls} h-20 text-xs font-mono resize-none`} style={inputStyle} placeholder='[[1,0,0,0],[0,1,0,1],[0,0,1,0],[0,1,0,1]]'/></div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" checked={vqeInvert} onChange={e => setVqeInvert(e.target.checked)} id="vqe-invert"
                                        className="accent-blue-500"/>
                                    <label htmlFor="vqe-invert" className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Invert adjacency (use distance matrix 1−A)</label>
                                </div>

                            </>)}

                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls} style={labelStyle}>Ansatz Depth</label><input type="number" value={ansatzDepth} onChange={e => setAnsatzDepth(+e.target.value||1)} className={inputCls} style={inputStyle} min={1} max={10}/></div>
                                <div><label className={labelCls} style={labelStyle}>Shots</label><input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} style={inputStyle} min={1}/></div>
                            </div>
                        </>)}

                        {/* Quantum Walk */}
                        {algorithm === 'Walk' && (<>
                            <div>
                                <label className={labelCls} style={labelStyle}>Graph Topology</label>
                                <select value={walkPreset} onChange={e => handleWalkPreset(e.target.value)} className={inputCls} style={inputStyle}>
                                    {Object.entries(WALK_PRESETS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                                {walkPreset !== 'custom_walk' && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{WALK_PRESETS[walkPreset]?.desc}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls} style={labelStyle}>Vertices</label>
                                    <input type="number" value={walkVertices} onChange={e => { setWalkVertices(+e.target.value||4); setWalkPreset('custom_walk'); }}
                                        className={inputCls} style={inputStyle} min={2} max={16}/></div>
                                <div><label className={labelCls} style={labelStyle}>Start Vertex</label>
                                    <input type="number" value={walkInitial} onChange={e => setWalkInitial(+e.target.value||0)}
                                        className={inputCls} style={inputStyle} min={0} max={walkVertices-1}/></div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls} style={labelStyle}>Time Steps</label>
                                    <input type="number" value={walkSteps} onChange={e => setWalkSteps(+e.target.value||10)}
                                        className={inputCls} style={inputStyle} min={1} max={50}/></div>
                                <div><label className={labelCls} style={labelStyle}>Δt</label>
                                    <input type="number" value={walkDt} onChange={e => setWalkDt(+e.target.value||0.5)}
                                        className={inputCls} style={inputStyle} min={0.1} max={2} step={0.1}/></div>
                            </div>
                            {walkPreset === 'custom_walk' && (
                                <div><label className={labelCls} style={labelStyle}>Adjacency Matrix <span style={{ color: 'var(--text-muted)' }}>(optional JSON)</span></label>
                                    <textarea value={walkMatrixStr} onChange={e => setWalkMatrixStr(e.target.value)}
                                        className={`${inputCls} h-16 text-xs font-mono resize-none`} style={inputStyle} placeholder='[[0,1,0],[1,0,1],[0,1,0]]'/></div>
                            )}
                            <div><label className={labelCls} style={labelStyle}>Shots</label>
                                <input type="number" value={shots} onChange={e => setShots(+e.target.value||1024)} className={inputCls} style={inputStyle} min={1}/></div>

                        </>)}

                        {/* Shared optimizer */}
                        {algorithm !== 'Walk' && (
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className={labelCls} style={labelStyle}>Optimizer</label>
                                    <select value={optimizer} onChange={e => setOptimizer(e.target.value)} className={inputCls} style={inputStyle}>
                                        <option value="COBYLA">COBYLA</option><option value="L-BFGS-B">L-BFGS-B</option>
                                        <option value="SLSQP">SLSQP</option><option value="Nelder-Mead">Nelder-Mead</option>
                                    </select></div>
                                <div><label className={labelCls} style={labelStyle}>Max Iterations</label>
                                    <input type="number" value={maxIter} onChange={e => setMaxIter(+e.target.value)} className={inputCls} style={inputStyle} min={1} max={1000}/></div>
                            </div>
                        )}
                    </div>

                    {/* Run button */}
                    <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-secondary)' }}>
                        <button onClick={handleRun} disabled={isLoading}
                            className={clsx("w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 font-medium transition-all text-sm text-white",
                                isLoading && "cursor-not-allowed opacity-70")}
                            style={{ background: isLoading ? 'var(--bg-tertiary)' : algorithm === 'Walk' ? 'var(--accent-primary)' : 'var(--accent-secondary)', color: isLoading ? 'var(--text-muted)' : 'white' }}>
                            {isLoading ? <><Loader2 size={16} className="animate-spin"/> Running…</>
                                : <><Play size={16}/> Run {algorithm === 'Walk' ? 'Quantum Walk' : algorithm}</>}
                        </button>
                    </div>

                    {/* Algorithm info notes — below Run button */}
                    <div className="mt-3 space-y-2">
                        {algorithm === 'QAOA' && (
                            <div className="rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--accent-secondary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-secondary) 30%, transparent)', color: 'var(--accent-secondary)' }}>
                                <div className="flex items-center gap-1 mb-1 font-semibold"><Info size={12}/> What is QAOA?</div>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    <strong>Quantum Approximate Optimization Algorithm</strong> finds near-optimal solutions to combinatorial problems.
                                    It encodes a problem (like MaxCut) into a <em>cost Hamiltonian</em> <span className="font-mono" style={{ color: 'var(--accent-secondary)' }}>H<sub>C</sub> = Σ J<sub>ij</sub> Z<sub>i</sub>Z<sub>j</sub> + Σ h<sub>i</sub> Z<sub>i</sub></span> and
                                    alternates between cost and mixer layers, each with tunable angles <strong>γ</strong> (cost) and <strong>β</strong> (mixer).
                                    A classical optimizer tunes these angles to minimize energy. The final measurement reveals the best solution found.
                                </p>
                                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                                    💡 <em>More layers (p) = better solutions but slower convergence. Start with p=1 for quick exploration.</em>
                                </p>
                            </div>
                        )}
                        {algorithm === 'VQE' && (
                            <div className="rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)', color: 'var(--accent-blue)' }}>
                                <div className="flex items-center gap-1 mb-1 font-semibold"><Info size={12}/> What is VQE?</div>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    <strong>Variational Quantum Eigensolver</strong> finds the lowest-energy state of a quantum system.
                                    It builds a Hamiltonian <span className="font-mono" style={{ color: 'var(--accent-blue)' }}>H = Σ c<sub>k</sub> · P<sub>k</sub></span> from Pauli strings (like <em>ZZ, XI, IY</em>) with
                                    scalar coefficients. A parameterized quantum circuit (ansatz) prepares trial states, and a
                                    classical optimizer adjusts the circuit parameters <strong>θ</strong> until the measured energy ⟨H⟩ is minimized.
                                </p>
                                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                                    💡 <em>In <strong>Hamiltonian</strong> mode, you specify Pauli terms directly. In <strong>MaxCut</strong> mode, VQE auto-builds a ZZ Hamiltonian from a graph to find the optimal partition.</em>
                                </p>
                            </div>
                        )}
                        {algorithm === 'VQE' && vqeMode === 'maxcut' && (
                            <div className="rounded-lg p-2 text-[10px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)', color: 'var(--accent-green)' }}>
                                <div className="flex items-center gap-1 mb-0.5 font-semibold"><Info size={12}/> MaxCut Clustering</div>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    Builds a <span className="font-mono" style={{ color: 'var(--accent-green)' }}>Z⊗Z</span> Hamiltonian from the graph adjacency matrix.
                                    Each qubit represents a vertex: <strong>|0⟩ → Cluster A</strong>, <strong>|1⟩ → Cluster B</strong>.
                                    The optimizer finds a partition that <em>maximizes</em> the number of edges cut between the two clusters.
                                </p>
                                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>💡 <em>Check "Invert adjacency" if your matrix represents similarities (1 = same group) instead of connections.</em></p>
                            </div>
                        )}
                        {algorithm === 'Walk' && (
                            <div className="rounded-lg p-2.5 text-[10px] leading-relaxed" style={{ background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)', color: 'var(--accent-primary)' }}>
                                <div className="flex items-center gap-1 mb-1 font-semibold"><Info size={12}/> What is a Quantum Walk?</div>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    A <strong>Continuous-Time Quantum Walk (CTQW)</strong> is the quantum analog of a classical random walk on a graph.
                                    The walker evolves via <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>U(t) = e<sup>−iAt</sup></span>, where <strong>A</strong> is the
                                    graph's adjacency matrix. Unlike classical random walks that converge to a uniform distribution,
                                    quantum walks exhibit <em>interference</em> — the probability amplitudes can constructively or destructively
                                    combine, leading to faster spreading and non-trivial localization effects.
                                </p>
                                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                                    💡 <em>Watch the probability bars shift as you drag the time slider — notice how the walker "spreads" across connected vertices over time, unlike a classical random walk.</em>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Results */}
                <div className="flex-1 p-4 md:p-5 flex flex-col relative overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                    <button onClick={onClose} className="absolute top-3 right-3 z-10 transition-colors" style={{ color: 'var(--text-muted)' }}><X size={20}/></button>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{algorithm === 'Walk' ? 'Quantum Walk' : algorithm} Results</h2>
                    <div className="flex-1 overflow-y-auto space-y-4">

                        {error && <div className="p-3 rounded-lg text-sm" style={{ color: 'var(--accent-red)', background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)' }}>{error}</div>}

                        {!activeResult && !isLoading && !error && (
                            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                                <p className="text-lg font-medium mb-1">Ready to Simulate</p>
                                <p className="text-sm">Configure and click <strong>Run</strong>.</p></div>
                        )}
                        {isLoading && (
                            <div className="flex flex-col items-center gap-3 py-16" style={{ color: 'var(--accent-secondary)' }}>
                                <Loader2 size={32} className="animate-spin"/><p className="text-sm">Running simulation…</p></div>
                        )}

                        {/* QAOA / VQE results */}
                        {(algorithm === 'QAOA' || algorithm === 'VQE') && activeResult && !isLoading && (<>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Optimal Energy</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--accent-green)' }}>{(activeResult as any).optimal_energy?.toFixed(6)}</p></div>
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Most Likely</p>
                                    <p className="text-base font-bold font-mono" style={{ color: 'var(--accent-primary)' }}>|{(activeResult as any).most_likely_state}⟩</p></div>
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Iterations</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{varHistory.length}</p></div>
                                {algorithm === 'QAOA' && qaoaResult && (
                                    <div className="rounded-lg p-3" style={cardStyle}>
                                        <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Layers</p>
                                        <p className="text-base font-bold" style={{ color: 'var(--accent-secondary)' }}>{qaoaResult.p_layers}</p></div>
                                )}
                                {algorithm === 'VQE' && vqeResult && (
                                    <div className="rounded-lg p-3" style={cardStyle}>
                                        <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Depth</p>
                                        <p className="text-base font-bold" style={{ color: 'var(--accent-blue)' }}>{vqeResult.ansatz_depth}</p></div>
                                )}
                            </div>

                            {/* Hamiltonian Terms (VQE) */}
                            {algorithm === 'VQE' && vqeResult && vqeMode === 'maxcut' && vqeResult.hamiltonian_bases && vqeResult.hamiltonian_bases.length > 0 && (
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Hamiltonian Terms ({vqeResult.hamiltonian_bases.length})</p>
                                    <div className="flex flex-wrap gap-2">
                                        {vqeResult.hamiltonian_bases.map((b, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)' }}>
                                                <span className="font-mono font-bold" style={{ color: 'var(--accent-secondary)' }}>{b}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>×</span>
                                                <span className="font-mono" style={{ color: 'var(--accent-primary)' }}>{vqeResult.hamiltonian_scales?.[i]?.toFixed(2)}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Graph Viz (QAOA) */}
                            {algorithm === 'QAOA' && qaoaResult && (() => {
                                let adjMatrix: number[][] = [];
                                try { adjMatrix = JSON.parse(matrixStr); } catch {}
                                if (adjMatrix.length > 0) {
                                    const n = adjMatrix.length;
                                    const symAdj = adjMatrix.map(r => [...r]);
                                    for (let i = 0; i < n; i++)
                                        for (let j = i + 1; j < n; j++) {
                                            const v = symAdj[i][j] || symAdj[j][i];
                                            symAdj[i][j] = v; symAdj[j][i] = v;
                                        }
                                    return <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{`Solution Graph — |${qaoaResult.most_likely_state}⟩`}</p>
                                            <SaveBtn onClick={() => downloadChartAsPng('qaoa-solution-graph', 'qaoa_solution_graph')}/>
                                        </div>
                                        <GraphVisualization id="qaoa-solution-graph" adjacencyMatrix={symAdj} solutionBitstring={qaoaResult.most_likely_state}
                                            cluster0Label="Set A" cluster1Label="Set B" />
                                    </div>;
                                }
                                return null;
                            })()}

                            {/* Graph Viz (VQE MaxCut) */}
                            {algorithm === 'VQE' && vqeResult && vqeMode === 'maxcut' && (() => {
                                let adjMatrix: number[][] = [];
                                try { adjMatrix = JSON.parse(vqeAdjStr); } catch {}
                                if (adjMatrix.length > 0) {
                                    const displayMatrix = vqeInvert ? adjMatrix.map((row, i) => row.map((v, j) => i === j ? 0 : 1 - v)) : adjMatrix;
                                    return <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{`MaxCut Solution${vqeInvert ? ' (inverted)' : ''} — |${vqeResult.most_likely_state}⟩`}</p>
                                            <SaveBtn onClick={() => downloadChartAsPng('vqe-solution-graph', 'vqe_maxcut_solution_graph')}/>
                                        </div>
                                        <GraphVisualization id="vqe-solution-graph" adjacencyMatrix={displayMatrix} solutionBitstring={vqeResult.most_likely_state}
                                            cluster0Label="Cluster A" cluster1Label="Cluster B" />
                                    </div>;
                                }
                                return null;
                            })()}

                            {/* γ/β or θ */}
                            {algorithm === 'QAOA' && qaoaResult && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded p-2" style={cardStyle}>
                                        <p className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>γ (cost)</p>
                                        <p className="text-xs font-mono" style={{ color: 'var(--accent-yellow)' }}>[{qaoaResult.optimal_gammas?.map(g => g.toFixed(4)).join(', ')}]</p></div>
                                    <div className="rounded p-2" style={cardStyle}>
                                        <p className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>β (mixer)</p>
                                        <p className="text-xs font-mono" style={{ color: 'var(--accent-orange)' }}>[{qaoaResult.optimal_betas?.map(b => b.toFixed(4)).join(', ')}]</p></div>
                                </div>
                            )}
                            {algorithm === 'VQE' && vqeResult && (
                                <div className="rounded p-2" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Optimal θ</p>
                                    <p className="text-xs font-mono break-all" style={{ color: 'var(--accent-yellow)' }}>[{vqeResult.optimal_params?.map(p => p.toFixed(4)).join(', ')}]</p></div>
                            )}

                            {/* Convergence */}
                            <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Convergence</p>
                                    <SaveBtn onClick={() => downloadChartAsPng('convergence-chart', `${algorithm}_convergence`)}/>
                                </div>
                                <div id="convergence-chart" className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)"/>
                                            <XAxis dataKey="iteration" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false}/>
                                            <Tooltip contentStyle={{ backgroundColor:'var(--tooltip-bg)', borderColor:'var(--tooltip-border)', color:'var(--tooltip-text)', fontSize:12 }}/>
                                            <Line type="monotone" dataKey="energy" stroke="var(--accent-secondary)" strokeWidth={2} dot={false}/>
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Counts */}
                            {(activeResult as any).counts && (
                                <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Measurement Counts</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries((activeResult as any).counts as Record<string,number>)
                                            .sort(([,a],[,b]) => b - a).slice(0,8)
                                            .map(([s,c]) => (
                                                <div key={s} className="rounded p-2 text-center" style={cardStyle}>
                                                    <p className="font-mono text-xs" style={{ color: 'var(--accent-primary)' }}>|{s}⟩</p>
                                                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c}</p></div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Waveform Probabilities */}
                            {(activeResult as any).probabilities && (activeResult as any).probabilities.length > 0 && (() => {
                                const probs: number[] = (activeResult as any).probabilities;
                                const numQ = algorithm === 'QAOA' ? qaoaQubits : vqeQubits;
                                const probData = probs.map((p, i) => ({
                                    state: `|${i.toString(2).padStart(numQ, '0')}⟩`,
                                    prob: parseFloat(p.toFixed(6)),
                                }));
                                const PROB_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16'];
                                return (
                                    <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Waveform Probabilities</p>
                                            <SaveBtn onClick={() => downloadChartAsPng('waveform-prob-chart', `${algorithm}_waveform_probabilities`)}/>
                                        </div>
                                        <div id="waveform-prob-chart" className="h-[200px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={probData}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)"/>
                                                    <XAxis dataKey="state" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={50}/>
                                                    <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 'auto']}/>
                                                    <Tooltip contentStyle={{ backgroundColor:'var(--tooltip-bg)', borderColor:'var(--tooltip-border)', color:'var(--tooltip-text)', fontSize:12 }}
                                                        formatter={(value: number | string | undefined) => [typeof value === 'number' ? value.toFixed(6) : value, 'Probability']}/>
                                                    <Bar dataKey="prob" radius={[4,4,0,0]}>
                                                        {probData.map((_, i) => <Cell key={i} fill={PROB_COLORS[i % PROB_COLORS.length]}/>)}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Circuit Diagram — tabbed view */}
                            <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                            {algorithm === 'QAOA' ? 'QAOA' : 'VQE Ansatz'} Circuit
                                        </p>
                                        <div className="flex rounded-md p-0.5" style={{ background: 'var(--bg-input)' }}>
                                            <button
                                                onClick={() => setCircuitView('highlevel')}
                                                className="px-2 py-0.5 text-[10px] rounded transition-colors font-medium"
                                                style={{ background: circuitView === 'highlevel' ? 'var(--accent-secondary)' : 'transparent', color: circuitView === 'highlevel' ? 'white' : 'var(--text-muted)' }}
                                            >High-Level</button>
                                            <button
                                                onClick={() => setCircuitView('qiskit')}
                                                className="px-2 py-0.5 text-[10px] rounded transition-colors font-medium"
                                                style={{ background: circuitView === 'qiskit' ? 'var(--accent-secondary)' : 'transparent', color: circuitView === 'qiskit' ? 'white' : 'var(--text-muted)' }}
                                            >Qiskit</button>
                                        </div>
                                    </div>
                                    <SaveBtn onClick={() =>
                                        circuitView === 'qiskit' && (activeResult as any).circuit_diagram
                                            ? downloadBase64Image((activeResult as any).circuit_diagram, `${algorithm}_qiskit_circuit`)
                                            : downloadChartAsPng(`${algorithm}-high-level-circuit`, `${algorithm}_circuit_structure`)
                                    }/>
                                </div>

                                {circuitView === 'highlevel' && (
                                    <div className="flex justify-center overflow-auto rounded">
                                        <HighLevelCircuitDiagram
                                            id={`${algorithm}-high-level-circuit`}
                                            algorithm={algorithm as 'QAOA' | 'VQE'}
                                            numQubits={algorithm === 'QAOA' ? qaoaQubits : vqeQubits}
                                            layers={algorithm === 'QAOA' ? pLayers : ansatzDepth}
                                        />
                                    </div>
                                )}

                                {circuitView === 'qiskit' && (
                                    (activeResult as any).circuit_diagram ? (
                                        <div className="flex justify-center overflow-auto rounded" style={{ background: '#ffffff' }}>
                                            <img
                                                src={`data:image/png;base64,${(activeResult as any).circuit_diagram}`}
                                                alt={`${algorithm} Qiskit circuit diagram`}
                                                className="max-w-full h-auto"
                                                style={{ maxHeight: '400px' }}
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
                                            Qiskit circuit diagram not available for this run.
                                        </p>
                                    )
                                )}
                            </div>
                        </>)}

                        {/* Quantum Walk results */}
                        {algorithm === 'Walk' && walkResult && !isLoading && (<>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Vertices</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--accent-primary)' }}>{walkResult.num_vertices}</p></div>
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Qubits</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--accent-secondary)' }}>{walkResult.num_qubits}</p></div>
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Most Likely</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--accent-green)' }}>v{walkResult.most_likely_vertex}</p></div>
                                <div className="rounded-lg p-3" style={cardStyle}>
                                    <p className="text-[10px] uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>t final</p>
                                    <p className="text-base font-bold" style={{ color: 'var(--accent-yellow)' }}>{((walkResult.num_steps||0) * (walkResult.dt||0)).toFixed(1)}</p></div>
                            </div>

                            {/* Walk Graph */}
                            {(() => {
                                let walkAdj: number[][] = [];
                                if (walkMatrixStr.trim()) {
                                    try { walkAdj = JSON.parse(walkMatrixStr); } catch {}
                                } else {
                                    const nv = walkResult.num_vertices || walkVertices;
                                    walkAdj = Array.from({length: nv}, () => Array(nv).fill(0));
                                    if (walkTopology === 'cycle') { for (let i = 0; i < nv; i++) { walkAdj[i][(i+1)%nv] = 1; walkAdj[(i+1)%nv][i] = 1; } }
                                    else if (walkTopology === 'path') { for (let i = 0; i < nv-1; i++) { walkAdj[i][i+1] = 1; walkAdj[i+1][i] = 1; } }
                                    else if (walkTopology === 'complete') { for (let i = 0; i < nv; i++) for (let j = i+1; j < nv; j++) { walkAdj[i][j] = 1; walkAdj[j][i] = 1; } }
                                    else if (walkTopology === 'star') { for (let i = 1; i < nv; i++) { walkAdj[0][i] = 1; walkAdj[i][0] = 1; } }
                                    else if (walkTopology === 'grid') {
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
                                    return <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{`Walk Graph — t = ${walkSnapshot?.time?.toFixed(2) ?? '0'}`}</p>
                                            <SaveBtn onClick={() => downloadChartAsPng('walk-solution-graph', 'walk_graph')}/>
                                        </div>
                                        <GraphVisualization id="walk-solution-graph" adjacencyMatrix={walkAdj} probabilities={snapProbs} />
                                    </div>;
                                }
                                return null;
                            })()}

                            {/* Probability distribution */}
                            <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                        Probability Distribution — t = {walkSnapshot?.time?.toFixed(2) ?? '0'}
                                    </p>
                                    <SaveBtn onClick={() => downloadChartAsPng('walk-prob-dist', 'walk_probability_distribution')}/>
                                </div>
                                <div id="walk-prob-dist" className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={walkBarData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)"/>
                                            <XAxis dataKey="vertex" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]}/>
                                            <Tooltip contentStyle={{ backgroundColor:'var(--tooltip-bg)', borderColor:'var(--tooltip-border)', color:'var(--tooltip-text)', fontSize:12 }}/>
                                            <Bar dataKey="prob" radius={[4,4,0,0]}>
                                                {walkBarData.map((_, i) => <Cell key={i} fill={VERTEX_COLORS[i % VERTEX_COLORS.length]}/>)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 flex items-center gap-3">
                                    <span className="text-[10px] w-8" style={{ color: 'var(--text-muted)' }}>t=0</span>
                                    <input type="range" min={0} max={walkResult.num_steps || walkSteps}
                                        value={walkTimeIdx} onChange={e => setWalkTimeIdx(+e.target.value)}
                                        className="flex-1 h-1"/>
                                    <span className="text-[10px] w-12 text-right" style={{ color: 'var(--text-muted)' }}>
                                        t={((walkResult.num_steps||0) * (walkResult.dt||0)).toFixed(1)}
                                    </span>
                                </div>
                            </div>

                            {/* Probability evolution */}
                            <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Probability Evolution</p>
                                    <SaveBtn onClick={() => downloadChartAsPng('walk-prob-evo', 'walk_probability_evolution')}/>
                                </div>
                                <div id="walk-prob-evo" className="h-[200px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={walkResult.probability_evolution?.map(snap => {
                                            const d: any = { time: snap.time };
                                            snap.probabilities.forEach((p, i) => { d[`v${i}`] = parseFloat(p.toFixed(4)); });
                                            return d;
                                        }) || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)"/>
                                            <XAxis dataKey="time" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false}/>
                                            <YAxis stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]}/>
                                            <Tooltip contentStyle={{ backgroundColor:'var(--tooltip-bg)', borderColor:'var(--tooltip-border)', color:'var(--tooltip-text)', fontSize:11 }}/>
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
                                <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                    <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>Final Measurement Counts</p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(walkResult.final_counts)
                                            .sort(([,a],[,b]) => b - a).slice(0,8)
                                            .map(([s,c]) => (
                                                <div key={s} className="rounded p-2 text-center" style={cardStyle}>
                                                    <p className="font-mono text-xs" style={{ color: 'var(--accent-primary)' }}>v{parseInt(s,2)}</p>
                                                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c}</p></div>
                                            ))}
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* Code export */}
                        {activeCode && !isLoading && (
                            <div className="rounded-lg p-3" style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-1"><Code size={14} style={{ color: 'var(--accent-blue)' }}/><p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Generated Code</p></div>
                                    <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] transition-colors" style={{ color: 'var(--text-muted)' }}>
                                        {copied ? <Check size={12} style={{ color: 'var(--accent-green)' }}/> : <Copy size={12}/>}
                                        {copied ? 'Copied!' : 'Copy'}</button>
                                </div>
                                <div className="flex gap-1 mb-2">
                                    {CODE_TABS.map(t => (
                                        <button key={t.key} onClick={() => setCodeTab(t.key)}
                                            className="px-2 py-1 text-[10px] rounded transition-colors"
                                            style={{ background: codeTab === t.key ? 'var(--accent-secondary)' : 'var(--bg-tertiary)', color: codeTab === t.key ? 'white' : 'var(--text-muted)' }}>
                                            {t.label}</button>
                                    ))}
                                </div>
                                <pre className="p-3 rounded text-[10px] overflow-auto max-h-[300px] font-mono leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
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
