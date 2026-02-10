'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { clsx } from 'clsx';

/**
 * Props for the Gate component.
 */
interface GateProps {
  /** Unique identifier used by dnd-kit for drag tracking. */
  id: string;
  /** Gate type label displayed inside the component (e.g. 'H', 'CZ'). */
  name: string;
  /** Optional additional Tailwind classes. */
  className?: string;
}

/**
 * Human-readable tooltip descriptions for every supported gate.
 * Shown on hover to help users understand each gate's function.
 */
const GATE_DESCRIPTIONS: Record<string, string> = {
  // --- Single-qubit ---
  'H':    'Hadamard: Creates equal superposition',
  'X':    'Pauli-X: Bit flip (NOT gate)',
  'Y':    'Pauli-Y: Bit + phase flip',
  'Z':    'Pauli-Z: Phase flip',
  'S':    'S Gate: √Z (π/2 phase)',
  'T':    'T Gate: ⁴√Z (π/4 phase)',
  'RX':   'RX: X-axis rotation',
  'RY':   'RY: Y-axis rotation',
  'RZ':   'RZ: Z-axis rotation',

  // --- Multi-qubit building blocks ---
  '•':    'Control: Pair with a target gate on another wire',
  '⊕':    'Target: Pair with • to create CNOT / Toffoli',
  'SWAP': 'SWAP: Place on two wires (or pair • + 2 SWAPs for Fredkin)',

  // --- Measurement ---
  'M':    'Measurement: Collapses state to classical bit',
};

/**
 * Draggable quantum gate chip.
 *
 * Render this in the palette (source) or within a CircuitCell (placed).
 * Uses @dnd-kit for drag-and-drop functionality.
 */
export const Gate: React.FC<GateProps> = ({ id, name, className }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { name },
  });

  const description = GATE_DESCRIPTIONS[name] || `${name} Gate`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={description}
      className={clsx(
        'w-12 h-12 flex items-center justify-center rounded-md border-2 border-cyan-500 bg-gray-800 text-cyan-50 font-bold cursor-grab hover:bg-gray-700 z-50',
        isDragging && 'opacity-0',
        className
      )}
    >
      {name}
    </div>
  );
};
