'use client';

import React from 'react';
import { Gate } from './Gate';

const GATES = ['H', 'X', 'Y', 'Z', 'RX', 'RY', 'RZ', '•', '⊕', 'M'];

/**
 * Renders a side panel containing draggable gates.
 * Users drag these gates onto the circuit grid.
 */
export const GatePalette: React.FC = () => {
  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-3">
      <h2 className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">Gate Palette</h2>
      <div className="grid grid-cols-3 gap-2">
        {GATES.map((gate) => (
          <Gate key={gate} id={`palette-${gate}`} name={gate} className="w-10 h-10 text-xs" />
        ))}
      </div>
    </div>
  );
};
