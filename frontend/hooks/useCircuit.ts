import { useState, useCallback } from 'react';

export interface CircuitStep {
  qubits: number[];
  gate: string;
  params?: number[];
  id: string; // Unique ID for valid React keys
}

type CircuitGrid = Record<string, string>; // cellId -> gateName
type GateParams = Record<string, number[]>; // cellId -> params

interface CircuitState {
  grid: CircuitGrid;
  params: GateParams;
  numQubits: number;
  numSteps: number;
  history: { grid: CircuitGrid; params: GateParams; numQubits: number; numSteps: number }[];
  historyIndex: number;
}

const DEFAULT_QUBITS = 3;
const DEFAULT_STEPS = 10;

export const useCircuit = () => {
  const [state, setState] = useState<CircuitState>({
    grid: {},
    params: {},
    numQubits: DEFAULT_QUBITS,
    numSteps: DEFAULT_STEPS,
    history: [{ grid: {}, params: {}, numQubits: DEFAULT_QUBITS, numSteps: DEFAULT_STEPS }],
    historyIndex: 0,
  });

  const updateState = (newGrid: CircuitGrid, newParams: GateParams, newNumQubits: number, newNumSteps: number) => {
      setState(prev => {
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({ grid: newGrid, params: newParams, numQubits: newNumQubits, numSteps: newNumSteps });
          return {
              grid: newGrid,
              params: newParams,
              numQubits: newNumQubits,
              numSteps: newNumSteps,
              history: newHistory,
              historyIndex: newHistory.length - 1
          };
      });
  };

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        const entry = prev.history[newIndex];
        return {
          ...prev,
          grid: entry.grid,
          params: entry.params,
          numQubits: entry.numQubits,
          numSteps: entry.numSteps,
          historyIndex: newIndex,
        };
      }
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        const entry = prev.history[newIndex];
        return {
          ...prev,
          grid: entry.grid,
          params: entry.params,
          numQubits: entry.numQubits,
          numSteps: entry.numSteps,
          historyIndex: newIndex,
        };
      }
      return prev;
    });
  }, []);

  const addGate = useCallback((cellId: string, gateName: string) => {
    setState((prev) => {
        const newGrid = { ...prev.grid, [cellId]: gateName };
        let newParams = { ...prev.params };

        // Parse cellId to check for expansion
        // Format: q{qubitIdx}-s{stepIdx}
        const [qPart, sPart] = cellId.split('-');
        const qubitIdx = parseInt(qPart.substring(1));
        const stepIdx = parseInt(sPart.substring(1));

        let newNumQubits = prev.numQubits;
        let newNumSteps = prev.numSteps;

        // Expand logic: if we place on the last available wire/step, add one more.
        if (qubitIdx >= prev.numQubits - 1) {
            newNumQubits = qubitIdx + 2; // Ensure always one empty after
        }
        if (stepIdx >= prev.numSteps - 1) {
            newNumSteps = stepIdx + 2; // Ensure always one empty after
        }

        // Initialize default parameters for rotational gates
        if (['RX', 'RY', 'RZ'].includes(gateName)) {
            newParams[cellId] = [Math.PI / 2];
        } else {
            delete newParams[cellId];
        }

        // Check if actually changed
        if (prev.grid[cellId] === gateName && 
            JSON.stringify(prev.params[cellId]) === JSON.stringify(newParams[cellId]) &&
            prev.numQubits === newNumQubits &&
            prev.numSteps === newNumSteps
           ) {
             return prev;
        }

        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        const historyEntry = { grid: newGrid, params: newParams, numQubits: newNumQubits, numSteps: newNumSteps };
        newHistory.push(historyEntry);
        
        return {
            grid: newGrid,
            params: newParams,
            numQubits: newNumQubits,
            numSteps: newNumSteps,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        };
    });
  }, []);

  const removeGate = useCallback((cellId: string) => {
    setState((prev) => {
        const newGrid = { ...prev.grid };
        delete newGrid[cellId];
        
        const newParams = { ...prev.params };
        delete newParams[cellId];

        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push({ grid: newGrid, params: newParams, numQubits: prev.numQubits, numSteps: prev.numSteps });

        return {
            ...prev,
            grid: newGrid,
            params: newParams,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        };
    });
  }, []);

  const updateGateParams = useCallback((cellId: string, params: number[]) => {
      setState(prev => {
          const newParams = { ...prev.params, [cellId]: params };
          
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({ grid: prev.grid, params: newParams, numQubits: prev.numQubits, numSteps: prev.numSteps });

          return {
              ...prev,
              params: newParams,
              history: newHistory,
              historyIndex: newHistory.length - 1
          };
      });
  }, []);

  const setCircuit = useCallback((newGrid: CircuitGrid, newParams: GateParams = {}) => {
      // Upon loading, calculate necessary size
      let maxQ = DEFAULT_QUBITS - 1;
      let maxS = DEFAULT_STEPS - 1;

      Object.keys(newGrid).forEach(key => {
          const [qPart, sPart] = key.split('-');
          const q = parseInt(qPart.substring(1));
          const s = parseInt(sPart.substring(1));
          if (q > maxQ) maxQ = q;
          if (s > maxS) maxS = s;
      });

      const newNumQubits = maxQ + 2;
      const newNumSteps = maxS + 2;

      setState(prev => {
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({ grid: newGrid, params: newParams, numQubits: newNumQubits, numSteps: newNumSteps });
          return {
              grid: newGrid,
              params: newParams,
              numQubits: newNumQubits,
              numSteps: newNumSteps,
              history: newHistory,
              historyIndex: newHistory.length - 1
          };
      });
  }, []);

  return {
    circuit: state.grid,
    gateParams: state.params,
    numQubits: state.numQubits,
    numSteps: state.numSteps,
    addGate,
    removeGate,
    updateGateParams,
    undo,
    redo,
    setCircuit,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
  };
};
