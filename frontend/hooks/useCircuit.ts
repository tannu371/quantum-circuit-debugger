import { useState, useCallback } from 'react';

export interface CircuitStep {
  qubits: number[];
  gate: string;
  params?: number[];
  id: string; // Unique ID for valid React keys
}

type CircuitGrid = Record<string, string>; // cellId -> gateName

interface CircuitState {
  grid: CircuitGrid;
  history: CircuitGrid[];
  historyIndex: number;
}

export const useCircuit = () => {
  const [state, setState] = useState<CircuitState>({
    grid: {},
    history: [{}],
    historyIndex: 0,
  });

  const updateGrid = useCallback((newGrid: CircuitGrid) => {
    setState((prev) => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newGrid);
      return {
        grid: newGrid,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        return {
          ...prev,
          grid: prev.history[newIndex],
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
        return {
          ...prev,
          grid: prev.history[newIndex],
          historyIndex: newIndex,
        };
      }
      return prev;
    });
  }, []);

  const addGate = useCallback((cellId: string, gateName: string) => {
    setState((prev) => {
        const newGrid = { ...prev.grid, [cellId]: gateName };
        // Check if actually changed
        if (prev.grid[cellId] === gateName) return prev;

        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push(newGrid);
        
        return {
            grid: newGrid,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        };
    });
  }, []);

  const removeGate = useCallback((cellId: string) => {
    setState((prev) => {
        const newGrid = { ...prev.grid };
        delete newGrid[cellId];
        
        const newHistory = prev.history.slice(0, prev.historyIndex + 1);
        newHistory.push(newGrid);

        return {
            grid: newGrid,
            history: newHistory,
            historyIndex: newHistory.length - 1,
        };
    });
  }, []);

  const setCircuit = useCallback((newGrid: CircuitGrid) => {
      setState(prev => {
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push(newGrid);
          return {
              grid: newGrid,
              history: newHistory,
              historyIndex: newHistory.length - 1
          };
      });
  }, []);

  return {
    circuit: state.grid,
    addGate,
    removeGate,
    undo,
    redo,
    setCircuit,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
  };
};
