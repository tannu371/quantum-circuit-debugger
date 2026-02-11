"use client";
import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { CircuitCell } from './CircuitCell';
import { GatePalette } from './GatePalette';
import AlgorithmModal from './AlgorithmModal';
import { useCircuit } from '../hooks/useCircuit';
import { useTheme } from './ThemeProvider';
import { RotateCcw, RotateCw, Trash2, Play, Loader2, Zap, Download, Code, FileText, Image as ImageIcon, FileCode, Save, Upload, Sun, Moon, Menu, X, ChevronDown, ChevronUp } from 'lucide-react';
import { ExecutionResults } from './ExecutionResults';
import { executeCircuit, optimizeCircuit, exportToLatex, exportToImage, exportToBloch, QuantumGate, ExecutionResult, OptimizationResult } from '../utils/api';
import { generateQiskitCode, generateOpenQASM, generatePennyLaneCode, generateCirqCode, generateQSharpCode } from '../utils/export';

/**
 * Main component for the Quantum Circuit Debugger.
 * Handles the state of the circuit, user interactions (drag-and-drop),
 * and communication with the backend for execution and optimization.
 */
export const CircuitBoard: React.FC = () => {
  const { circuit, gateParams, numQubits, numSteps, addGate, removeGate, updateGateParams, undo, redo, setCircuit, canUndo, canRedo } = useCircuit();
  const { theme, toggleTheme } = useTheme();
  
  // UI state for simulation and optimization
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Algorithm Modal State
  const [isAlgorithmModalOpen, setIsAlgorithmModalOpen] = useState(false);

  // Track the currently dragged gate for the DragOverlay
  const [activeGate, setActiveGate] = useState<string | null>(null);
  
  // UI state for code export viewing
  const [showCode, setShowCode] = useState<'qiskit' | 'qasm' | 'latex' | 'pennylane' | 'cirq' | 'qsharp' | null>(null);
  const [latexCode, setLatexCode] = useState<string>('');
  
  // Bloch Sphere State
  const [blochImages, setBlochImages] = useState<string[]>([]);
  const [isBlochLoading, setIsBlochLoading] = useState(false);

  // Mobile UI State
  const [mobileGatePaletteOpen, setMobileGatePaletteOpen] = useState(false);
  const [mobileBlochOpen, setMobileBlochOpen] = useState(false);

  // Live Bloch Sphere Effect
  useEffect(() => {
    const fetchBloch = async () => {
        setIsBlochLoading(true);
        try {
            const gates = getGatesFromGrid();
            const data = await exportToBloch(gates, numQubits);
            if ((data as any).error) {
                console.error("Bloch error:", (data as any).error);
            } else {
                if ((data as any).bloch_images) {
                    setBlochImages((data as any).bloch_images);
                } else if ((data as any).image_base64) {
                    setBlochImages([(data as any).image_base64]);
                }
            }
        } catch (err) {
            console.error("Failed to fetch bloch sphere:", err);
        } finally {
            setIsBlochLoading(false);
        }
    };

    const timer = setTimeout(() => {
        fetchBloch();
    }, 500);

    return () => clearTimeout(timer);
  }, [circuit, gateParams, numQubits, numSteps]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveGate((event.active.data.current?.name as string) || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGate(null);
    const { active, over } = event;
    if (over && active.data.current) {
        const gateName = active.data.current.name as string;
        const cellId = over.id as string;
        addGate(cellId, gateName);
    }
  };

  const PARAMETERISED_GATES = new Set(['RX', 'RY', 'RZ']);

  const CONTROLLED_NAME: Record<string, string> = {
    '⊕': 'CNOT',
    'X': 'CX',
    'Y': 'CY',
    'Z': 'CZ',
    'H': 'CH',
    'RX': 'CRX',
    'RY': 'CRY',
    'RZ': 'CRZ',
  };

  const getGatesFromGrid = () => {
      const gates: QuantumGate[] = [];

      for (let step = 0; step < numSteps; step++) {
          const controlQubits: number[] = [];
          const targets: { name: string; qubit: number; params?: number[] }[] = [];
          const swapQubits: number[] = [];

          for (let qubit = 0; qubit < numQubits; qubit++) {
              const cellId = `q${qubit}-s${step}`;
              const gateName = circuit[cellId];
              const params = gateParams[cellId];

              if (!gateName) continue;

              if (gateName === '•') {
                  controlQubits.push(qubit);
              } else if (gateName === 'SWAP') {
                  swapQubits.push(qubit);
              } else {
                  targets.push({
                      name: gateName,
                      qubit,
                      params: params || undefined,
                  });
              }
          }

          if (controlQubits.length > 0) {
              if (controlQubits.length === 1 && swapQubits.length === 2) {
                  gates.push({
                      name: 'CSWAP',
                      qubits: [controlQubits[0], swapQubits[0], swapQubits[1]],
                  });
              }
              else if (controlQubits.length >= 2) {
                  const toffoliTarget = targets.find(t => t.name === '⊕' || t.name === 'X');
                  if (toffoliTarget) {
                      gates.push({
                          name: 'CCX',
                          qubits: [...controlQubits.slice(0, 2), toffoliTarget.qubit],
                      });
                      const idx = targets.indexOf(toffoliTarget);
                      if (idx !== -1) targets.splice(idx, 1);
                  }
              }
              else if (controlQubits.length === 1) {
                  const ctrl = controlQubits[0];
                  const targetIdx = targets.findIndex(t => CONTROLLED_NAME[t.name] !== undefined);

                  if (targetIdx !== -1) {
                      const tgt = targets[targetIdx];
                      const controlledName = CONTROLLED_NAME[tgt.name];
                      const entry: QuantumGate = {
                          name: controlledName,
                          qubits: [ctrl, tgt.qubit],
                      };
                      if (tgt.params) entry.params = tgt.params;
                      gates.push(entry);
                      targets.splice(targetIdx, 1);
                  }
              }
          } else {
              if (swapQubits.length === 2) {
                  gates.push({ name: 'SWAP', qubits: [swapQubits[0], swapQubits[1]] });
              }
          }

          for (const g of targets) {
              if (g.name === 'M') {
                  gates.push({ name: 'M', qubits: [g.qubit] });
              } else if (PARAMETERISED_GATES.has(g.name)) {
                  gates.push({
                      name: g.name,
                      qubits: [g.qubit],
                      params: g.params || [Math.PI / 2],
                  });
              } else {
                  gates.push({ name: g.name, qubits: [g.qubit] });
              }
          }
      }

      return gates;
  };

  const runSimulation = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
        const gates = getGatesFromGrid();
        const data = await executeCircuit(gates, numQubits);
        if (data.status === 'failed') {
            setError(data.error || 'Execution failed');
        } else {
            setResult(data);
        }
    } catch (err: any) {
        setError(err.message || 'Failed to connect to backend');
    } finally {
        setIsRunning(false);
    }
  };

  const runOptimization = async () => {
      try {
          const gates = getGatesFromGrid();
          const data = await optimizeCircuit(gates, numQubits);
          if (data.error) {
              setError(data.error);
          } else {
              setOptResult(data);
              setShowCode(null);
          }
      } catch (err: any) {
          setError(err.message || 'Optimization failed');
      }
  };

  const handleExport = async (type: 'qiskit' | 'qasm' | 'latex' | 'pennylane' | 'cirq' | 'qsharp') => {
      if (type === 'latex') {
          try {
              const gates = getGatesFromGrid();
              const data = await exportToLatex(gates, numQubits);
              setLatexCode(data.latex);
              setShowCode('latex');
              setOptResult(null);
          } catch (err: any) {
              setError('Failed to export LaTeX: ' + err.message);
          }
      } else {
            setShowCode(type === showCode ? null : type);
            setOptResult(null); 
      }
  };

  const handleDownloadImage = async () => {
      try {
          const gates = getGatesFromGrid();
          const data = await exportToImage(gates, numQubits);
          
          const link = document.createElement('a');
          link.href = `data:image/png;base64,${data.image_base64}`;
          link.download = 'circuit.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (err: any) {
          setError('Failed to export image: ' + err.message);
      }
  };

  const saveCircuit = () => {
      const data = JSON.stringify({circuit, gateParams}, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'quantum_circuit.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const loadCircuit = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const loadedData = JSON.parse(content);
              if (loadedData.circuit) {
                  setCircuit(loadedData.circuit, loadedData.gateParams || {});
              } else {
                  setCircuit(loadedData);
              }
              setError(null);
          } catch (err) {
              setError('Failed to parse circuit file');
          }
      };
      reader.readAsText(file);
  };

  // Shared button styles
  const iconBtnStyle: React.CSSProperties = { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' };
  const iconBtnHoverCls = "transition-colors hover:opacity-80";

  return (
    <DndContext id="dnd-context" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="flex h-screen overflow-hidden text-sm"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      >
        {/* Mobile overlay when gate palette is open */}
        {mobileGatePaletteOpen && (
          <div
            className="fixed inset-0 z-30 md:hidden"
            style={{ background: 'var(--bg-overlay)' }}
            onClick={() => setMobileGatePaletteOpen(false)}
          />
        )}

        {/* Left Sidebar: Gate Palette */}
        <GatePalette mobileOpen={mobileGatePaletteOpen} />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header
              className="flex flex-wrap justify-between items-center p-3 z-20 gap-2"
              style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-primary)' }}
            >
                <div className="flex items-center gap-2">
                    {/* Mobile hamburger for gate palette */}
                    <button
                      onClick={() => setMobileGatePaletteOpen(!mobileGatePaletteOpen)}
                      className="p-1.5 rounded md:hidden"
                      style={iconBtnStyle}
                    >
                      {mobileGatePaletteOpen ? <X size={16} /> : <Menu size={16} />}
                    </button>
                    <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                        Quantum Circuit Debugger
                    </h1>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3 items-center">
                    <div className="flex gap-1">
                        <button onClick={undo} disabled={!canUndo} className={`p-1.5 rounded disabled:opacity-50 ${iconBtnHoverCls}`} style={iconBtnStyle} title="Undo"><RotateCcw size={16} /></button>
                        <button onClick={redo} disabled={!canRedo} className={`p-1.5 rounded disabled:opacity-50 ${iconBtnHoverCls}`} style={iconBtnStyle} title="Redo"><RotateCw size={16} /></button>
                    </div>
                    
                    <div className="flex rounded p-1 gap-1 items-center" style={{ background: 'var(--bg-tertiary)' }}>
                        <button onClick={() => handleExport('qasm')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export OpenQASM">
                            <FileCode size={16} />
                        </button>
                        <button onClick={() => handleExport('latex')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export LaTeX">
                            <FileText size={16} />
                        </button>
                        <button onClick={() => handleExport('qiskit')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export Qiskit">
                            <Code size={16} />
                        </button>
                        <button onClick={() => handleExport('pennylane')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export PennyLane">
                            <span className="font-bold text-[10px]">PL</span>
                        </button>
                        <button onClick={() => handleExport('cirq')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export Cirq">
                            <span className="font-bold text-[10px]">Cq</span>
                        </button>
                        <button onClick={() => handleExport('qsharp')} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Export Q#">
                            <span className="font-bold text-[10px]">Q#</span>
                        </button>
                        
                        <div className="w-px mx-1 self-stretch" style={{ background: 'var(--border-secondary)' }} />
                        <button onClick={handleDownloadImage} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Download Image">
                            <ImageIcon size={16} />
                        </button>
                         <button onClick={saveCircuit} className={`p-1.5 rounded ${iconBtnHoverCls}`} title="Save Circuit">
                            <Save size={16} />
                        </button>
                        <label className={`p-1.5 rounded cursor-pointer ${iconBtnHoverCls}`} title="Load Circuit">
                            <Upload size={16} />
                            <input type="file" onChange={loadCircuit} accept=".json" className="hidden" />
                        </label>
                    </div>

                    {/* Theme toggle */}
                    <button
                      onClick={toggleTheme}
                      className={`p-1.5 rounded ${iconBtnHoverCls}`}
                      style={iconBtnStyle}
                      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>

                    <button 
                        onClick={() => setIsAlgorithmModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded font-semibold transition-colors text-xs text-white"
                        style={{ background: 'var(--accent-blue)' }}
                    >
                        <Zap size={16} />
                        <span className="hidden sm:inline">Algorithms</span>
                    </button>

                    <button 
                        onClick={runOptimization}
                        className="flex items-center gap-2 px-3 py-1.5 rounded font-semibold transition-colors text-xs text-white"
                        style={{ background: 'var(--accent-secondary)' }}
                    >
                        <Zap size={16} />
                        <span className="hidden sm:inline">Optimize</span>
                    </button>

                    <button 
                        onClick={runSimulation}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-3 py-1.5 rounded font-semibold transition-colors disabled:opacity-70 disabled:cursor-wait text-xs text-white"
                        style={{ background: 'var(--accent-green)' }}
                    >
                        {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                        {isRunning ? 'Running...' : 'Run'}
                    </button>
                </div>
            </header>

            {/* Split View: Circuit + Results vs Bloch Sidebar */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Center Panel (Circuit + Results) */}
                <div className="flex-1 flex flex-col p-4 overflow-auto scrollbar-thin">
                     {/* Circuit Grid */}
                    <div
                      className="rounded-xl p-4 md:p-6 shadow-2xl overflow-x-auto min-h-[200px] md:min-h-[300px] mb-6"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                    >
                        <div className="flex flex-col gap-4 min-w-max">
                            {Array.from({ length: numQubits }).map((_, qubitIdx) => (
                                <div key={`qubit-${qubitIdx}`} className="flex items-center group">
                                    <div className="w-12 text-right pr-4 font-mono flex items-center justify-end text-sm" style={{ color: 'var(--text-muted)' }}>
                                        <span>q[{qubitIdx}]</span>
                                    </div>
                                    <div className="flex relative items-center">
                                        {/* Wire Line */}
                                        <div className="absolute left-0 right-0 h-0.5 -z-0" style={{ background: 'var(--wire-color)' }} />
                                        {Array.from({ length: numSteps }).map((_, stepIdx) => {
                                            const cellId = `q${qubitIdx}-s${stepIdx}`;
                                            return (
                                                <div key={cellId} className="relative z-10 mx-0.5">
                                                    <CircuitCell 
                                                        id={cellId} 
                                                        gate={circuit[cellId]} 
                                                        params={gateParams[cellId]}
                                                        onRemove={() => removeGate(cellId)}
                                                        onUpdateParams={(p) => updateGateParams(cellId, p)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Results / Code Panel */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <ExecutionResults result={result} error={error} isRunning={isRunning} />
                        
                        <div className="flex flex-col gap-4">
                            {/* Code Export Panel */}
                            {showCode && (
                                <div
                                  className="p-4 rounded-lg shadow-lg h-full"
                                  style={{ background: 'var(--bg-secondary)', border: '1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent)' }}
                                >
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-blue)' }}>
                                        <Code size={16} /> Generated Code ({
                                            {
                                                'qiskit': 'Qiskit',
                                                'qasm': 'OpenQASM',
                                                'latex': 'LaTeX',
                                                'pennylane': 'PennyLane',
                                                'cirq': 'Cirq',
                                                'qsharp': 'Q#'
                                            }[showCode as string]
                                        })
                                    </h3>
                                    <pre
                                      className="p-3 rounded text-xs overflow-auto h-[400px] font-mono leading-relaxed"
                                      style={{ background: 'var(--bg-code)', color: 'var(--text-secondary)' }}
                                    >
                                        {showCode === 'qiskit' 
                                            ? generateQiskitCode(getGatesFromGrid(), numQubits) 
                                            : showCode === 'qasm'
                                                ? generateOpenQASM(getGatesFromGrid(), numQubits)
                                                : showCode === 'pennylane'
                                                    ? generatePennyLaneCode(getGatesFromGrid(), numQubits)
                                                    : showCode === 'cirq'
                                                        ? generateCirqCode(getGatesFromGrid(), numQubits)
                                                        : showCode === 'qsharp'
                                                            ? generateQSharpCode(getGatesFromGrid(), numQubits)
                                                            : latexCode
                                        }
                                    </pre>
                                </div>
                            )}

                             {/* Optimization Results Panel */}
                             {optResult && !showCode && (
                                <div
                                  className="p-4 rounded-lg shadow-lg"
                                  style={{ background: 'var(--bg-secondary)', border: '1px solid color-mix(in srgb, var(--accent-secondary) 30%, transparent)' }}
                                >
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent-secondary)' }}>
                                        <Zap size={16} /> Optimization Report
                                    </h3>
                                    <div className="text-xs space-y-2">
                                        <div className="p-2 rounded" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-secondary)' }}>
                                            <div className="font-medium" style={{ color: 'var(--accent-green)' }}>{optResult.improvement_msg}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div className="p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Original Depth</div>
                                                <div className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>{optResult.original_depth}</div>
                                            </div>
                                            <div className="p-2 rounded" style={{ background: 'var(--bg-tertiary)' }}>
                                                <div className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Optimized Depth</div>
                                                <div className="text-lg font-mono" style={{ color: 'var(--accent-primary)' }}>{optResult.optimized_depth}</div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Optimized QASM:</div>
                                            <pre className="p-2 rounded text-[10px] overflow-x-auto" style={{ background: 'var(--bg-code)', color: 'var(--text-muted)' }}>
                                                {optResult.optimized_qasm}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                             {!optResult && !showCode && (
                                <div className="p-4 rounded-lg mb-auto" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Logs</h3>
                                    <div className="font-mono text-[10px] flex flex-col gap-1 max-h-[200px] overflow-y-auto" style={{ color: 'var(--accent-green)' }}>
                                        <div>{'>'} System initialized. Ready.</div>
                                        {isRunning && <div>{'>'} Sending circuit to backend...</div>}
                                        {result && <div>{'>'} Execution completed successfully.</div>}
                                        {error && <div style={{ color: 'var(--accent-red)' }}>{'>'} Error: {error}</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar / Mobile Collapsible: Live Bloch Sphere */}
                <div
                  className="w-full md:w-[340px] flex flex-col md:h-full overflow-hidden md:border-l"
                  style={{ background: 'color-mix(in srgb, var(--bg-secondary) 50%, transparent)', borderColor: 'var(--border-primary)' }}
                >
                     {/* Bloch header — clickable on mobile to expand/collapse */}
                     <div
                       className="p-4 flex-none z-10 flex items-center justify-between cursor-pointer md:cursor-default"
                       style={{ borderBottom: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-secondary) 50%, transparent)' }}
                       onClick={() => setMobileBlochOpen(!mobileBlochOpen)}
                     >
                        <h2 className="text-lg font-bold bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50"></span>
                            Live Bloch Sphere
                        </h2>
                        <button className="md:hidden p-1" style={{ color: 'var(--text-muted)' }}>
                          {mobileBlochOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                     </div>
                     
                     <div className={`flex-1 p-4 min-h-0 flex-col overflow-hidden ${mobileBlochOpen ? 'flex' : 'hidden md:flex'}`}>
                        <div
                          className="rounded-lg flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-4 items-center relative"
                          style={{ background: 'var(--bg-code)', border: '1px solid var(--border-secondary)' }}
                        >
                            {isBlochLoading && (
                                <div className="absolute inset-0 flex items-center justify-center z-20 backdrop-blur-sm rounded-lg transition-all duration-300" style={{ background: 'var(--bg-overlay)' }}>
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-red)' }} />
                                        <span className="text-xs font-mono" style={{ color: 'var(--accent-red)' }}>Updating...</span>
                                    </div>
                                </div>
                            )}
                            {blochImages.length > 0 ? (
                                blochImages.map((img, idx) => (
                                    <div key={idx} className="flex flex-col items-center w-full rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--bg-secondary) 30%, transparent)', border: '1px solid var(--border-subtle)' }}>
                                        <div className="text-[10px] uppercase tracking-widest font-bold mb-1 w-full text-left pl-2" style={{ color: 'var(--text-muted)' }}>Qubit {idx}</div>
                                        <img src={`data:image/png;base64,${img}`} alt={`Bloch Sphere Qubit ${idx}`} className="w-full h-auto rounded shadow-lg" />
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                     <div className="w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center opacity-50" style={{ borderColor: 'var(--border-secondary)' }}>
                                        <Zap size={24} />
                                     </div>
                                     <div className="text-xs text-center">
                                         Run or modify the circuit<br/>to see visualization
                                     </div>
                                </div>
                            )}
                        </div>
                     </div>

                     <div
                       className={`p-4 pt-0 flex-none text-[10px] ${mobileBlochOpen ? 'block' : 'hidden md:block'}`}
                       style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', background: 'color-mix(in srgb, var(--bg-secondary) 30%, transparent)' }}
                     >
                         <div className="mt-2">
                            Updates automatically as you modify the circuit.
                            <br/>
                            Double-click rotation gates to edit angles.
                         </div>
                     </div>
                </div>
            </div>
        </div>
      </div>
      
      <AlgorithmModal 
        isOpen={isAlgorithmModalOpen} 
        onClose={() => setIsAlgorithmModalOpen(false)}
        circuit={getGatesFromGrid()}
        numQubits={numQubits}
      />
      {/* Floating drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeGate ? (
          <div
            className="w-12 h-12 flex items-center justify-center rounded-md border-2 font-bold shadow-lg pointer-events-none"
            style={{ borderColor: 'var(--accent-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            {activeGate}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
