import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import { Gate } from './Gate';

interface CircuitCellProps {
  id: string;
  gate?: string | null;
  onRemove?: () => void;
}

export const CircuitCell: React.FC<CircuitCellProps> = ({ id, gate, onRemove }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onRemove?.();
  };

  return (
    <div
      ref={setNodeRef}
      onContextMenu={handleContextMenu}
      className={clsx(
        'w-16 h-16 border border-gray-700/50 flex items-center justify-center relative transition-colors rounded-sm ml-px',
        isOver ? 'bg-cyan-900/40 border-cyan-500' : 'bg-gray-800/20 hover:bg-gray-800/40' // Improved styling
      )}
    >
      {/* Wire guide now handled by parent container to avoid z-index issues, but kept subtle border */}
      {gate ? (
        <Gate id={`placed-${id}`} name={gate} className="shadow-lg" />
      ) : (
        <div className="w-2 h-2 rounded-full bg-gray-700/50" /> // Snap point indicator
      )}
    </div>
  );
};
