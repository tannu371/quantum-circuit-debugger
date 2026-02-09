'use client';

import React from 'react';
import { Gate } from './Gate';

const GATES = ['H', 'X', 'Y', 'Z', 'CNOT', 'M'];

export const GatePalette: React.FC = () => {
  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-4">
      <h2 className="text-xl font-bold text-cyan-400 mb-4">Gate Palette</h2>
      <div className="grid grid-cols-3 gap-3">
        {GATES.map((gate) => (
          <Gate key={gate} id={`palette-${gate}`} name={gate} />
        ))}
      </div>
    </div>
  );
};
