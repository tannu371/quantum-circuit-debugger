import React, { useState } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { CircuitCell } from './CircuitCell';
import { GatePalette } from './GatePalette';
import { useCircuit } from '../hooks/useCircuit';
import { RotateCcw, RotateCw, Trash2, Play, Loader2 } from 'lucide-react';
import { ExecutionResults } from './ExecutionResults';
import { executeCircuit, optimizeCircuit, exportToLatex, exportToImage, QuantumGate, ExecutionResult, OptimizationResult } from '../utils/api';
import { generateQiskitCode, generateOpenQASM } from '../utils/export';
import { Zap, Download, Code, FileText, Image as ImageIcon, FileCode, Save, Upload } from 'lucide-react';

const DEFAULT_QUBITS = 3;
const DEFAULT_STEPS = 8;

export const CircuitBoard: React.FC = () => {
  const { circuit, addGate, removeGate, undo, redo, setCircuit, canUndo, canRedo } = useCircuit();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState<'qiskit' | 'qasm' | 'latex' | null>(null);
  const [latexCode, setLatexCode] = useState<string>('');

  // ... (handleDragEnd, getGatesFromGrid, runSimulation, runOptimization)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.data.current) {
        const gateName = active.data.current.name as string;
        const cellId = over.id as string;
        addGate(cellId, gateName);
    }
  };

  const getGatesFromGrid = () => {
      const gates: QuantumGate[] = [];
      for (let step = 0; step < DEFAULT_STEPS; step++) {
          for (let qubit = 0; qubit < DEFAULT_QUBITS; qubit++) {
              const cellId = `q${qubit}-s${step}`;
              const gateName = circuit[cellId];
              if (gateName) {
                  gates.push({
                      name: gateName,
                      qubits: [qubit] // TODO: Handle multi-qubit gates
                  });
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
        const data = await executeCircuit(gates, DEFAULT_QUBITS);
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
          const data = await optimizeCircuit(gates, DEFAULT_QUBITS);
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

  const handleExport = async (type: 'qiskit' | 'qasm' | 'latex') => {
      if (type === 'latex') {
          try {
              const gates = getGatesFromGrid();
              const data = await exportToLatex(gates, DEFAULT_QUBITS);
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
          const data = await exportToImage(gates, DEFAULT_QUBITS);
          
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
      const data = JSON.stringify(circuit, null, 2);
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
              const loadedCircuit = JSON.parse(content);
              // Basic validation could go here
              setCircuit(loadedCircuit);
              setError(null);
          } catch (err) {
              setError('Failed to parse circuit file');
          }
      };
      reader.readAsText(file);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex h-screen bg-gray-950 text-white">
        <GatePalette />
        <div className="flex-1 p-8 overflow-auto flex flex-col">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                    Quantum Circuit Debugger
                </h1>
                <div className="flex gap-4">
                    <button onClick={undo} disabled={!canUndo} className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"><RotateCcw size={20} /></button>
                    <button onClick={redo} disabled={!canRedo} className="p-2 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50"><RotateCw size={20} /></button>
                    
                    <div className="flex bg-gray-800 rounded p-1 gap-1">
                        <button onClick={() => handleExport('qiskit')} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Export Python">
                            <Code size={18} />
                        </button>
                        <button onClick={() => handleExport('qasm')} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Export OpenQASM">
                            <FileCode size={18} />
                        </button>
                        <button onClick={() => handleExport('latex')} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Export LaTeX">
                            <FileText size={18} />
                        </button>
                        <button onClick={handleDownloadImage} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Download Image">
                            <ImageIcon size={18} />
                        </button>
                        <div className="w-px bg-gray-700 mx-1 self-stretch" />
                         <button onClick={saveCircuit} className="p-2 hover:bg-gray-700 rounded transition-colors" title="Save Circuit">
                            <Save size={18} />
                        </button>
                        <label className="p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer" title="Load Circuit">
                            <Upload size={18} />
                            <input type="file" onChange={loadCircuit} accept=".json" className="hidden" />
                        </label>
                    </div>

                    <button 
                        onClick={runOptimization}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-semibold transition-colors"
                    >
                        <Zap size={20} />
                        Optimize
                    </button>

                    <button 
                        onClick={runSimulation}
                        disabled={isRunning}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-semibold transition-colors disabled:opacity-70 disabled:cursor-wait"
                    >
                        {isRunning ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
                        {isRunning ? 'Running...' : 'Run Circuit'}
                    </button>
                </div>
            </header>
            
            {/* Circuit Grid */}
            <div className="bg-gray-900 rounded-xl p-8 shadow-2xl border border-gray-800 overflow-x-auto min-h-[400px]">
                {/* ... same grid rendering ... */}
                <div className="flex flex-col gap-6 min-w-max">
                    {Array.from({ length: DEFAULT_QUBITS }).map((_, qubitIdx) => (
                        <div key={`qubit-${qubitIdx}`} className="flex items-center group">
                            <div className="w-16 text-right pr-6 font-mono text-gray-500 text-lg flex items-center justify-end">
                                <span>q[{qubitIdx}]</span>
                            </div>
                            <div className="flex relative items-center">
                                {/* Wire Line */}
                                <div className="absolute left-0 right-0 h-0.5 bg-gray-700 -z-0" />
                                {Array.from({ length: DEFAULT_STEPS }).map((_, stepIdx) => {
                                    const cellId = `q${qubitIdx}-s${stepIdx}`;
                                    return (
                                        <div key={cellId} className="relative z-10 mx-1">
                                            <CircuitCell 
                                                id={cellId} 
                                                gate={circuit[cellId]} 
                                                onRemove={() => removeGate(cellId)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Results Grid */}
            <div className="mt-8 grid grid-cols-2 gap-8">
                <ExecutionResults result={result} error={error} isRunning={isRunning} />
                
                <div className="flex flex-col gap-8">
                    {/* Code Export Panel */}
                    {showCode && (
                        <div className="bg-gray-900 p-6 rounded-lg border border-blue-900/50 shadow-lg shadow-blue-900/10 h-full">
                            <h3 className="text-lg font-semibold text-blue-300 mb-4 flex items-center gap-2">
                                <Code size={18} /> Generated Code ({showCode.toUpperCase()})
                            </h3>
                            <pre className="bg-black/50 p-4 rounded text-xs text-gray-300 overflow-auto h-[200px] font-mono">
                                {showCode === 'qiskit' 
                                    ? generateQiskitCode(getGatesFromGrid(), DEFAULT_QUBITS) 
                                    : showCode === 'qasm'
                                        ? generateOpenQASM(getGatesFromGrid(), DEFAULT_QUBITS)
                                        : latexCode
                                }
                            </pre>
                        </div>
                    )}

                    {/* Optimization Results Panel */}
                    {optResult && !showCode && (
                        <div className="bg-gray-900 p-6 rounded-lg border border-purple-900/50 shadow-lg shadow-purple-900/10">
                            <h3 className="text-lg font-semibold text-purple-300 mb-4 flex items-center gap-2">
                                <Zap size={18} /> Optimization Report
                            </h3>
                            <div className="text-sm space-y-2">
                                <div className="p-3 bg-gray-800/50 rounded border border-gray-700">
                                    <div className="text-green-400 font-medium">{optResult.improvement_msg}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div className="p-3 bg-gray-800 rounded">
                                        <div className="text-gray-500 text-xs uppercase">Original Depth</div>
                                        <div className="text-xl font-mono text-white">{optResult.original_depth}</div>
                                    </div>
                                    <div className="p-3 bg-gray-800 rounded">
                                        <div className="text-gray-500 text-xs uppercase">Optimized Depth</div>
                                        <div className="text-xl font-mono text-cyan-400">{optResult.optimized_depth}</div>
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <div className="text-gray-500 text-xs mb-1">Optimized QASM:</div>
                                    <pre className="bg-black/50 p-2 rounded text-xs text-gray-400 overflow-x-auto">
                                        {optResult.optimized_qasm}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}

                    {!optResult && !showCode && (
                        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 mb-auto">
                            <h3 className="text-lg font-semibold text-gray-300 mb-4">Logs</h3>
                            <div className="font-mono text-sm text-green-400 flex flex-col gap-1 max-h-[250px] overflow-y-auto">
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
      </div>
    </DndContext>
  );
};
