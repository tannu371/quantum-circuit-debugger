'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ExecutionResult } from '../utils/api';

/**
 * Props for the ExecutionResults component.
 */
interface ExecutionResultsProps {
  result: ExecutionResult | null;
  error: string | null;
  isRunning: boolean;
}

/**
 * Displays the results of a circuit execution.
 * Renders a bar chart of state probabilities and optionally statevector details.
 */
export const ExecutionResults: React.FC<ExecutionResultsProps> = ({ result, error, isRunning }) => {
  if (isRunning) {
    return (
        <div
          className="p-8 rounded-lg flex items-center justify-center min-h-[300px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
            <div className="animate-pulse" style={{ color: 'var(--accent-primary)' }}>Running Simulation...</div>
        </div>
    );
  }

  if (error) {
    return (
        <div
          className="p-8 rounded-lg min-h-[300px]"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Execution Results</h3>
            <div
              className="p-4 rounded"
              style={{ color: 'var(--accent-red)', background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)' }}
            >
                Error: {error}
            </div>
        </div>
    );
  }

  if (!result) {
    return (
        <div
          className="p-8 rounded-lg min-h-[300px] flex items-center justify-center"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
        >
             <div className="italic" style={{ color: 'var(--text-muted)' }}>Run the circuit to see results...</div>
        </div>
    );
  }

  // Prepare data for chart
  let chartData = [];
  
  if (result.statevector) {
      chartData = result.statevector.map((amp, idx) => {
          const probability = amp[0]**2 + amp[1]**2;
          const binary = idx.toString(2).padStart(Math.log2(result.statevector!.length), '0');
          return {
              state: binary,
              probability: probability,
              amplitude: `(${amp[0].toFixed(3)}) + (${amp[1].toFixed(3)})i`
          };
      });
  } else {
      const totalShots = Object.values(result.counts).reduce((a, b) => a + b, 0);
      chartData = Object.entries(result.counts).map(([state, count]) => ({
          state,
          probability: count / totalShots,
          count
      }));
  }

  // Filter out zero probabilities for cleaner view
  chartData = chartData.filter(d => d.probability > 0.001);

  return (
    <div
      className="p-6 rounded-lg min-h-[300px]"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--accent-primary)' }}>State Probabilities</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="state" stroke="var(--chart-axis)" />
            <YAxis stroke="var(--chart-axis)" />
            <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg)',
                  borderColor: 'var(--tooltip-border)',
                  color: 'var(--tooltip-text)',
                }}
                cursor={{ fill: 'var(--chart-grid)', opacity: 0.4 }}
            />
            <Bar dataKey="probability" fill="var(--accent-primary)" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.probability > 0.1 ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--accent-primary) 60%, transparent)'} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {result.statevector && (
          <div className="mt-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              * Showing states with probability &gt; 0.1%
          </div>
      )}
    </div>
  );
};
