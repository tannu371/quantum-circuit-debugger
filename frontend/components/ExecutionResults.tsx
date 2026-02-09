'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ExecutionResult } from '../utils/api';

/**
 * Props for the ExecutionResults component.
 */
interface ExecutionResultsProps {
  result: ExecutionResult | null; // The execution result data
  error: string | null; // Error message if execution failed
  isRunning: boolean; // Loading state
}

/**
 * Displays the results of a circuit execution.
 * Renders a bar chart of state probabilities and optionally statevector details.
 */
export const ExecutionResults: React.FC<ExecutionResultsProps> = ({ result, error, isRunning }) => {
  if (isRunning) {
    return (
        <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 flex items-center justify-center min-h-[300px]">
            <div className="text-cyan-400 animate-pulse">Running Simulation...</div>
        </div>
    );
  }

  if (error) {
    return (
        <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 min-h-[300px]">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">Execution Results</h3>
            <div className="text-red-400 p-4 bg-red-900/20 rounded border border-red-900/50">
                Error: {error}
            </div>
        </div>
    );
  }

  if (!result) {
    return (
        <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 min-h-[300px] flex items-center justify-center">
             <div className="text-gray-500 italic">Run the circuit to see results...</div>
        </div>
    );
  }

  // Prepare data for chart
  let chartData = [];
  
  if (result.statevector) {
      // Calculate probabilities from statevector
      chartData = result.statevector.map((amp, idx) => {
          const probability = amp[0]**2 + amp[1]**2;
          // Binary string for label (assuming up to 5 qubits roughly)
          const binary = idx.toString(2).padStart(Math.log2(result.statevector!.length), '0');
          return {
              state: binary,
              probability: probability,
              amplitude: `(${amp[0].toFixed(3)}) + (${amp[1].toFixed(3)})i`
          };
      });
  } else {
      // Fallback to counts if no statevector
      const totalShots = Object.values(result.counts).reduce((a, b) => a + b, 0);
      chartData = Object.entries(result.counts).map(([state, count]) => ({
          state,
          probability: count / totalShots,
          count
      }));
  }

  // Filter out zero probabilities for cleaner view if too many states
  chartData = chartData.filter(d => d.probability > 0.001);

  return (
    <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 min-h-[300px]">
      <h3 className="text-lg font-semibold text-cyan-300 mb-6">State Probabilities</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="state" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                cursor={{ fill: '#374151', opacity: 0.4 }}
            />
            <Bar dataKey="probability" fill="#06B6D4" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.probability > 0.1 ? '#22D3EE' : '#0E7490'} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {result.statevector && (
          <div className="mt-4 text-xs text-gray-500 text-center">
              * Showing states with probability &gt; 0.1%
          </div>
      )}
    </div>
  );
};
