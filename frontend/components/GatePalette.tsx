'use client';

import React from 'react';
import { Gate } from './Gate';

/**
 * Gate palette sections — organised by category for quick access.
 *
 * **UX Pattern for controlled operations:**
 *   Place • (control dot) on the control wire(s) and the desired target
 *   gate on the target wire at the *same time step*.  The system will
 *   auto-detect the controlled variant:
 *     • + H  → CH       • + Y  → CY      • + Z  → CZ
 *     • + RX → CRX      • + ⊕  → CNOT    •• + ⊕ → CCX (Toffoli)
 *     • + SWAP pair → CSWAP (Fredkin)
 */
const GATE_SECTIONS: { label: string; gates: string[] }[] = [
  { label: 'Basic',       gates: ['H', 'X', 'Y', 'Z', 'S', 'T'] },
  { label: 'Rotation',    gates: ['RX', 'RY', 'RZ'] },
  { label: 'Multi-Qubit', gates: ['•', '⊕', 'SWAP'] },
  { label: 'Utility',     gates: ['M'] },
];

/**
 * Side panel containing draggable quantum gate chips.
 *
 * Gates are grouped into labelled sections (Basic, Rotation, Multi-Qubit,
 * Utility).  To create controlled operations, drag • onto control wire(s)
 * and the target gate onto the target wire at the same step.
 */
export const GatePalette: React.FC = () => {
  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-3 overflow-y-auto">
      <h2 className="text-sm font-bold text-cyan-400 mb-1 uppercase tracking-wider">Gate Palette</h2>

      {GATE_SECTIONS.map((section) => (
        <div key={section.label}>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
            {section.label}
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {section.gates.map((gate) => (
              <Gate
                key={gate}
                id={`palette-${gate}`}
                name={gate}
                className="w-10 h-10 text-[10px]"
              />
            ))}
          </div>
        </div>
      ))}

      {/* Usage hint */}
      <div className="mt-2 p-2 bg-gray-800/50 rounded text-[9px] text-gray-400 leading-relaxed">
        <span className="text-cyan-400 font-bold">Controlled gates:</span> Place{' '}
        <span className="text-yellow-400 font-mono">•</span> on control wire(s) and the
        target gate (H, Y, Z, RX…) on the target wire at the same step.
        <br />
        <span className="text-gray-500">• + ⊕ → CNOT&ensp;|&ensp;•• + ⊕ → Toffoli</span>
      </div>
    </div>
  );
};
