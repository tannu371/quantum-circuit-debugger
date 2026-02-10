"use client";
import React, { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from '@dnd-kit/core';
import { CircuitCell } from './CircuitCell';
import { GatePalette } from './GatePalette';
import AlgorithmModal from './AlgorithmModal';
import { useCircuit } from '../hooks/useCircuit';
import { RotateCcw, RotateCw, Trash2, Play, Loader2, Zap, Download, Code, FileText, Image as ImageIcon, FileCode, Save, Upload } from 'lucide-react';
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
                // Determine if data is the old single-image format or new list format
                if ((data as any).bloch_images) {
                    setBlochImages((data as any).bloch_images);
                } else if ((data as any).image_base64) {
                    // Fallback if backend returned old format (shouldn't happen if updated correctly)
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
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [circuit, gateParams, numQubits, numSteps]);


  /**
   * Called when a drag begins — stores the gate name so DragOverlay can
   * render a floating clone while the original stays in place.
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveGate((event.active.data.current?.name as string) || null);
  };

  /**
   * Handles the end of a drag event.
   * If a gate is dropped onto a valid cell, it updates the circuit state.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveGate(null);
    const { active, over } = event;
    if (over && active.data.current) {
        const gateName = active.data.current.name as string;
        const cellId = over.id as string;
        addGate(cellId, gateName);
    }
  };

  /** Gates that carry rotation / phase parameters. */
  const PARAMETERISED_GATES = new Set(['RX', 'RY', 'RZ']);

  /**
   * Map from a *target* gate name to the controlled version sent to the
   * backend.  When a • control is paired with one of these gates at the
   * same step, the controlled name is used instead.
   */
  const CONTROLLED_NAME: Record<string, string> = {
    '⊕': 'CNOT', // • + ⊕ → CNOT
    'X': 'CX',
    'Y': 'CY',
    'Z': 'CZ',
    'H': 'CH',
    'RX': 'CRX',
    'RY': 'CRY',
    'RZ': 'CRZ',
  };

  /**
   * Converts the grid-based circuit state into a linear list of gates
   * suitable for the backend API.
   *
   * **Control-detection algorithm (per time-step):**
   *
   *  1. Scan wires and collect • (control) qubit indices.
   *  2. Collect all non-control, non-SWAP gate placements as *targets*.
   *  3. Collect SWAP placements separately (SWAP needs 2 wires).
   *  4. Combine:
   *     - 1 control + supported target → controlled gate (CY, CH, CRX, …)
   *     - 2 controls + ⊕/X target → CCX (Toffoli)
   *     - 1 control + 2 SWAPs → CSWAP (Fredkin)
   *     - 2 SWAPs without control → plain SWAP
   *     - Remaining gates without a control → plain single-qubit gates
   */
  const getGatesFromGrid = () => {
      const gates: QuantumGate[] = [];

      for (let step = 0; step < numSteps; step++) {
          // --- 1. Collect controls, targets, and SWAPs --------------------
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

          // --- 2. Combine controls + targets → controlled gates -----------

          if (controlQubits.length > 0) {
              // We have control dot(s) — look for something to control

              // Check for CSWAP: 1 control + 2 SWAP chips
              if (controlQubits.length === 1 && swapQubits.length === 2) {
                  gates.push({
                      name: 'CSWAP',
                      qubits: [controlQubits[0], swapQubits[0], swapQubits[1]],
                  });
                  // Consume all — skip to remaining un-paired targets below
              }
              // Check for Toffoli: 2 controls + ⊕ or X target
              else if (controlQubits.length >= 2) {
                  const toffoliTarget = targets.find(t => t.name === '⊕' || t.name === 'X');
                  if (toffoliTarget) {
                      gates.push({
                          name: 'CCX',
                          qubits: [...controlQubits.slice(0, 2), toffoliTarget.qubit],
                      });
                      // Remove used target so it is not emitted again below
                      const idx = targets.indexOf(toffoliTarget);
                      if (idx !== -1) targets.splice(idx, 1);
                  }
                  // Remaining controls without a valid target are ignored
              }
              // 1 control + a supported target gate
              else if (controlQubits.length === 1) {
                  const ctrl = controlQubits[0];

                  // Find the first compatible target
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
              // No controls — plain SWAP if 2 SWAP chips on different wires
              if (swapQubits.length === 2) {
                  gates.push({ name: 'SWAP', qubits: [swapQubits[0], swapQubits[1]] });
              }
          }

          // --- 3. Emit remaining un-paired single-qubit gates -------------
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

  /**
   * Sends the current circuit to the backend for execution.
   * Updates the result state with counts and statevector.
   */
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

  /**
   * Sends the current circuit to the backend for optimization.
   * Updates the optimization result state.
   */
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

  /**
   * Handles exporting the circuit to various code formats (QASM, LaTeX, Qiskit, PennyLane, Cirq, Q#).
   */
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

  /**
   * Fetches the circuit image from the backend and triggers a download.
   */
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

  /**
   * Saves the current circuit layout to a JSON file.
   */
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

  /**
   * Loads a circuit layout from a user-uploaded JSON file.
   */
  const loadCircuit = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const loadedData = JSON.parse(content);
              // Handle legacy format (just circuit) vs new format (circuit + params)
              if (loadedData.circuit) {
                  setCircuit(loadedData.circuit, loadedData.gateParams || {});
              } else {
                  setCircuit(loadedData); // Legacy
              }
              setError(null);
          } catch (err) {
              setError('Failed to parse circuit file');
          }
      };
      reader.readAsText(file);
  };

  return (
    <DndContext id="dnd-context" onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-screen bg-gray-950 text-white overflow-hidden text-sm"> {/* Global text-sm */}
        {/* Left Sidebar: Gate Palette */}
        <GatePalette />
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <header className="flex justify-between items-center p-3 border-b border-gray-800 bg-gray-950 z-20">
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    Quantum Circuit Debugger
                </h1>
                <div className="flex gap-3">
                    <div className="flex gap-1">
                        <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50" title="Undo"><RotateCcw size={16} /></button>
                        <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50" title="Redo"><RotateCw size={16} /></button>
                    </div>
                    
                    <div className="flex bg-gray-800 rounded p-1 gap-1 items-center">
                        <button onClick={() => handleExport('qasm')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export OpenQASM">
                            <FileCode size={16} />
                        </button>
                        <button onClick={() => handleExport('latex')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export LaTeX">
                            <FileText size={16} />
                        </button>
                        <button onClick={() => handleExport('qiskit')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export Qiskit">
                            <Code size={16} />
                        </button>
                        <button onClick={() => handleExport('pennylane')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export PennyLane">
                            <span className="font-bold text-[10px]">PL</span>
                        </button>
                        <button onClick={() => handleExport('cirq')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export Cirq">
                            <span className="font-bold text-[10px]">Cq</span>
                        </button>
                        <button onClick={() => handleExport('qsharp')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Export Q#">
                            <span className="font-bold text-[10px]">Q#</span>
                        </button>
                        
                        <div className="w-px bg-gray-700 mx-1 self-stretch" />
                        <button onClick={handleDownloadImage} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Download Image">
                            <ImageIcon size={16} />
                        </button>
                         <button onClick={saveCircuit} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Save Circuit">
                            <Save size={16} />
                        </button>
                        <label className="p-1.5 hover:bg-gray-700 rounded transition-colors cursor-pointer" title="Load Circuit">
                            <Upload size={16} />
                            <input type="file" onChange={loadCircuit} accept=".json" className="hidden" />
                        </label>
                    </div>

                    <button 
                        onClick={() => setIsAlgorithmModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded font-semibold transition-colors text-xs"
                    >
                        <Zap size={16} />
                        Algorithms
                    </button>

                    <button 
                        onClick={runOptimization}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors text-xs"
                    >
                        <Zap size={16} />
                        Optimize
                    </button>

                    <button 
                        onClick={runSimulation}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded font-semibold transition-colors disabled:opacity-70 disabled:cursor-wait text-xs"
                    >
                        {isRunning ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                        {isRunning ? 'Running...' : 'Run'}
                    </button>
                </div>
            </header>

            {/* Split View: Circuit + Results vs Bloch Sidebar */}
            <div className="flex-1 flex overflow-hidden">
                {/* Center Panel (Circuit + Results) */}
                <div className="flex-1 flex flex-col p-4 overflow-auto scrollbar-thin scrollbar-thumb-gray-800">
                     {/* Circuit Grid */}
                    <div className="bg-gray-900 rounded-xl p-6 shadow-2xl border border-gray-800 overflow-x-auto min-h-[300px] mb-6">
                        <div className="flex flex-col gap-4 min-w-max">
                            {Array.from({ length: numQubits }).map((_, qubitIdx) => (
                                <div key={`qubit-${qubitIdx}`} className="flex items-center group">
                                    <div className="w-12 text-right pr-4 font-mono text-gray-500 flex items-center justify-end text-sm">
                                        <span>q[{qubitIdx}]</span>
                                    </div>
                                    <div className="flex relative items-center">
                                        {/* Wire Line */}
                                        <div className="absolute left-0 right-0 h-0.5 bg-gray-700 -z-0" />
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
                    <div className="flex-1 grid grid-cols-2 gap-6">
                        <ExecutionResults result={result} error={error} isRunning={isRunning} />
                        
                        <div className="flex flex-col gap-4">
                            {/* Code Export Panel */}
                            {showCode && (
                                <div className="bg-gray-900 p-4 rounded-lg border border-blue-900/50 shadow-lg shadow-blue-900/10 h-full">
                                    <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
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
                                    <pre className="bg-black/50 p-3 rounded text-xs text-gray-300 overflow-auto h-[400px] font-mono leading-relaxed">
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
                                <div className="bg-gray-900 p-4 rounded-lg border border-purple-900/50 shadow-lg shadow-purple-900/10">
                                    <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                                        <Zap size={16} /> Optimization Report
                                    </h3>
                                    <div className="text-xs space-y-2">
                                        <div className="p-2 bg-gray-800/50 rounded border border-gray-700">
                                            <div className="text-green-400 font-medium">{optResult.improvement_msg}</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div className="p-2 bg-gray-800 rounded">
                                                <div className="text-gray-500 text-[10px] uppercase">Original Depth</div>
                                                <div className="text-lg font-mono text-white">{optResult.original_depth}</div>
                                            </div>
                                            <div className="p-2 bg-gray-800 rounded">
                                                <div className="text-gray-500 text-[10px] uppercase">Optimized Depth</div>
                                                <div className="text-lg font-mono text-cyan-400">{optResult.optimized_depth}</div>
                                            </div>
                                        </div>
                                        <div className="mt-2">
                                            <div className="text-gray-500 text-[10px] mb-1">Optimized QASM:</div>
                                            <pre className="bg-black/50 p-2 rounded text-[10px] text-gray-400 overflow-x-auto">
                                                {optResult.optimized_qasm}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                             {!optResult && !showCode && (
                                <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 mb-auto">
                                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Logs</h3>
                                    <div className="font-mono text-[10px] text-green-400 flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                                        <div>{'>'} System initialized. Ready.</div>
                                        {isRunning && <div>{'>'} Sending circuit to backend...</div>}
                                        {result && <div>{'>'} Execution completed successfully.</div>}
                                        {error && <div className="text-red-400">{'>'} Error: {error}</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar: Live Bloch Sphere */}
                <div className="w-[340px] bg-gray-900/50 border-l border-gray-800 flex flex-col h-full overflow-hidden">
                     <div className="p-4 border-b border-gray-800/50 flex-none bg-gray-900/50 backdrop-blur-sm z-10">
                        <h2 className="text-lg font-bold bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50"></span>
                            Live Bloch Sphere
                        </h2>
                     </div>
                     
                     <div className="flex-1 p-4 min-h-0 flex flex-col overflow-hidden">
                        <div className="bg-black/40 rounded-lg border border-gray-700 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 p-4 flex flex-col gap-4 items-center relative">
                            {isBlochLoading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 backdrop-blur-sm rounded-lg transition-all duration-300">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="animate-spin text-red-500" size={32} />
                                        <span className="text-xs text-red-400 font-mono">Updating...</span>
                                    </div>
                                </div>
                            )}
                            {blochImages.length > 0 ? (
                                blochImages.map((img, idx) => (
                                    <div key={idx} className="flex flex-col items-center w-full bg-gray-900/30 rounded-lg p-2 border border-gray-800/50">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1 w-full text-left pl-2">Qubit {idx}</div>
                                        <img src={`data:image/png;base64,${img}`} alt={`Bloch Sphere Qubit ${idx}`} className="w-full h-auto rounded shadow-lg" />
                                    </div>
                                ))
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2">
                                     <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center opacity-50">
                                        <Zap size={24} />
                                     </div>
                                     <div className="text-xs text-center">
                                         Run or modify the circuit<br/>to see visualization
                                     </div>
                                </div>
                            )}
                        </div>
                     </div>

                     <div className="p-4 pt-0 flex-none text-[10px] text-gray-500 border-t border-gray-800/30 bg-gray-900/30">
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
      {/* Floating drag overlay — prevents the palette from shifting */}
      <DragOverlay dropAnimation={null}>
        {activeGate ? (
          <div className="w-12 h-12 flex items-center justify-center rounded-md border-2 border-cyan-400 bg-gray-800 text-cyan-50 font-bold shadow-lg shadow-cyan-500/30 pointer-events-none">
            {activeGate}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
