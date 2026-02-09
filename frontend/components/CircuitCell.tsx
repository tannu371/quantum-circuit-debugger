import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDroppable } from '@dnd-kit/core';
import { clsx } from 'clsx';
import { Gate } from './Gate';

/**
 * Props for the CircuitCell component.
 */
interface CircuitCellProps {
  id: string; // Unique identifier for the cell (qubit-step coordinates)
  gate?: string | null; // The gate currently placed in this cell, if any
  params?: number[]; // Parameters for the gate (e.g., rotation angles)
  onRemove?: () => void; // Callback to remove the gate from this cell
  onUpdateParams?: (params: number[]) => void; // Callback to update parameters
}

/**
 * Represents a single cell in the quantum circuit grid.
 * Acts as a droppable target for gates.
 */
export const CircuitCell: React.FC<CircuitCellProps> = ({ id, gate, params, onRemove, onUpdateParams }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('0');
  const [editUnit, setEditUnit] = useState<'rad' | 'pi'>('pi'); // Default to pi for convenience
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close editor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // Since the popover is in a portal, we check if the click is NOT in the popover (screen logic)
        // We will attach a ref to the portal content or stopPropagation on the portal content.
        // Actually simplest is: if logic handles closing in the portal, we just need to ensure clicking 'outside' works.
        // But the portal is outside the cellRef. 
        // We'll handle 'click outside' by checking if the target is part of the cell OR the portal.
        // Easier: The popover itself can allow clicks. Clicks elsewhere close it.
        // We can check if the click target is within the portal DOM node.
        
        const portalEl = document.getElementById(`editor-portal-${id}`);
        if (isEditing && 
            cellRef.current && !cellRef.current.contains(event.target as Node) &&
            portalEl && !portalEl.contains(event.target as Node)
           ) {
            setIsEditing(false);
        }
    };

    if (isEditing) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, id]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (gate) {
        onRemove?.();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (gate && ['RX', 'RY', 'RZ'].includes(gate) && onUpdateParams) {
          // Calculate position
          if (cellRef.current) {
              const rect = cellRef.current.getBoundingClientRect();
              setPopoverPos({
                  top: rect.bottom + window.scrollY + 5,
                  left: rect.left + window.scrollX + rect.width / 2
              });
          }
          
          setIsEditing(true);
          const currentRad = params ? params[0] : Math.PI / 2;
          
          const piMultiple = currentRad / Math.PI;
          if (Math.abs(piMultiple - Math.round(piMultiple * 100) / 100) < 0.001) {
              setEditUnit('pi');
              setEditValue(piMultiple.toFixed(2).replace(/\.00$/, ''));
          } else {
              setEditUnit('rad');
              setEditValue(currentRad.toFixed(2));
          }
      }
  };

  const handleSave = (e?: React.FormEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const num = parseFloat(editValue);
      if (!isNaN(num) && onUpdateParams) {
          const finalRad = editUnit === 'pi' ? num * Math.PI : num;
          onUpdateParams([finalRad]);
      }
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleSave();
      } else if (e.key === 'Escape') {
          e.stopPropagation();
          setIsEditing(false);
      }
  };

  return (
    <>
        <div
        ref={(node) => { setNodeRef(node); cellRef.current = node; }}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        className={clsx(
            'w-12 h-12 border border-gray-700/50 flex items-center justify-center relative transition-colors rounded-sm ml-px',
            isOver ? 'bg-cyan-900/40 border-cyan-500' : 'bg-gray-800/20 hover:bg-gray-800/40',
            isEditing ? 'ring-1 ring-cyan-500 bg-gray-800/60' : ''
        )}
        title={gate && ['RX', 'RY', 'RZ'].includes(gate) ? "Double-click to edit angle" : undefined}
        >
        {gate ? (
            <div className="relative flex flex-col items-center">
                <Gate id={`placed-${id}`} name={gate} className="shadow-lg w-10 h-10 text-xs" />
                
                {/* Display Value */}
                {params && ['RX', 'RY', 'RZ'].includes(gate) && !isEditing && (
                    <span className="absolute -bottom-3 text-[9px] text-cyan-400 font-mono bg-black/80 px-1 rounded pointer-events-none whitespace-nowrap z-10">
                        {(params[0] / Math.PI).toFixed(2).replace('.00', '')}π
                    </span>
                )}
            </div>
        ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-gray-700/50" /> // Snap point indicator
        )}
        </div>

        {/* Portal for Editor */}
        {isEditing && typeof document !== 'undefined' && createPortal(
            <div 
                id={`editor-portal-${id}`}
                className="fixed z-[9999] bg-gray-950 border border-gray-600 shadow-2xl rounded p-2 flex flex-col gap-2 min-w-[140px]"
                style={{ 
                    top: popoverPos.top, 
                    left: popoverPos.left,
                    transform: 'translateX(-50%)' 
                }}
                onMouseDown={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="flex items-center gap-1 bg-gray-900 rounded p-0.5 border border-gray-800">
                    <button 
                        type="button"
                        onClick={() => setEditUnit('rad')}
                        className={clsx("flex-1 text-[9px] py-1 rounded transition-colors font-medium", editUnit === 'rad' ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white")}
                    >
                        Rad
                    </button>
                    <button 
                        type="button"
                        onClick={() => setEditUnit('pi')}
                        className={clsx("flex-1 text-[9px] py-1 rounded transition-colors font-medium", editUnit === 'pi' ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white")}
                    >
                        π
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <input 
                        autoFocus
                        type="number" 
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-cyan-500 text-white placeholder-gray-600"
                        placeholder="Angle..."
                    />
                </div>
                <div className="flex gap-1">
                        <button onClick={() => setIsEditing(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-[9px] py-1 rounded text-gray-300 transition-colors border border-gray-700">Cancel</button>
                        <button onClick={handleSave} className="flex-1 bg-green-600 hover:bg-green-700 text-[9px] py-1 rounded text-white transition-colors shadow-sm shadow-green-900/20">Set</button>
                </div>
            </div>,
            document.body
        )}
    </>
  );
};

