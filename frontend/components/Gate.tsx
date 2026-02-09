'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';

/**
 * Props for the Gate component.
 */
interface GateProps {
  id: string; // Unique ID for drag-and-drop tracking
  name: string; // The type of gate (e.g., 'H', 'X')
  className?: string; // Optional additional CSS classes
}

/**
 * Represents a draggable quantum gate.
 * Can be dragged from the palette or within the circuit grid.
 */
const GATE_DESCRIPTIONS: Record<string, string> = {
  'H': 'Hadamard Gate: Creates superposition',
  'X': 'Pauli-X Gate: Bit flip (NOT)',
  'Y': 'Pauli-Y Gate: Bit and phase flip',
  'Z': 'Pauli-Z Gate: Phase flip',
  'RX': 'RX Gate: X-axis rotation (π/2)',
  'RY': 'RY Gate: Y-axis rotation (π/2)',
  'RZ': 'RZ Gate: Z-axis rotation (π/2)',
  'CNOT': 'Controlled-NOT: Entangles qubits',
  'CX': 'Controlled-NOT: Entangles qubits',
  '•': 'Control Qubit: Controls the target',
  '⊕': 'Target Qubit: Flips if control is |1>',
  'M': 'Measurement: Collapses state'
};

export const Gate: React.FC<GateProps> = ({ id, name, className }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: { name },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const description = GATE_DESCRIPTIONS[name] || `${name} Gate`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={description}
      className={clsx(
        'w-12 h-12 flex items-center justify-center rounded-md border-2 border-cyan-500 bg-gray-800 text-cyan-50 font-bold cursor-grab hover:bg-gray-700 z-50',
        isDragging && 'opacity-50',
        className
      )}
    >
      {name}
    </div>
  );
};
