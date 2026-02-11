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

interface GatePaletteProps {
  /** Whether the palette is open on mobile (controlled by parent) */
  mobileOpen?: boolean;
}

/**
 * Side panel containing draggable quantum gate chips.
 *
 * Gates are grouped into labelled sections (Basic, Rotation, Multi-Qubit,
 * Utility).  To create controlled operations, drag • onto control wire(s)
 * and the target gate onto the target wire at the same step.
 */
export const GatePalette: React.FC<GatePaletteProps> = ({ mobileOpen }) => {
  return (
    <div
      className={`w-56 border-r p-3 flex flex-col gap-3 overflow-y-auto transition-transform duration-200
        max-md:fixed max-md:top-0 max-md:left-0 max-md:h-full max-md:z-40 max-md:shadow-2xl
        ${mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
        md:relative md:translate-x-0`}
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <h2
        className="text-sm font-bold mb-1 uppercase tracking-wider"
        style={{ color: 'var(--accent-primary)' }}
      >
        Gate Palette
      </h2>

      {GATE_SECTIONS.map((section) => (
        <div key={section.label}>
          <h3
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
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
      <div
        className="mt-2 p-2 rounded text-[9px] leading-relaxed"
        style={{
          background: 'var(--bg-hover)',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ color: 'var(--accent-primary)' }} className="font-bold">Controlled gates:</span> Place{' '}
        <span className="font-mono" style={{ color: 'var(--accent-yellow)' }}>•</span> on control wire(s) and the
        target gate (H, Y, Z, RX…) on the target wire at the same step.
        <br />
        <span style={{ color: 'var(--text-muted)' }}>• + ⊕ → CNOT&ensp;|&ensp;•• + ⊕ → Toffoli</span>
      </div>
    </div>
  );
};
