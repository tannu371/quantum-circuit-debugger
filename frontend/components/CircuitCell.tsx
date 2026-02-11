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
  const [editUnit, setEditUnit] = useState<'rad' | 'pi'>('pi');
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const cellRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close editor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      if (gate && ['RX', 'RY', 'RZ', 'CRX', 'CRY', 'CRZ'].includes(gate) && onUpdateParams) {
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
            'w-12 h-12 flex items-center justify-center relative transition-colors rounded-sm ml-px',
            isEditing ? 'ring-1' : ''
        )}
        style={{
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: isOver ? 'var(--accent-primary)' : 'var(--border-subtle)',
            background: isOver
              ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'
              : isEditing
                ? 'var(--bg-hover)'
                : 'color-mix(in srgb, var(--bg-tertiary) 20%, transparent)',
            ...(isEditing ? { '--tw-ring-color': 'var(--accent-primary)' } as React.CSSProperties : {}),
        }}
        title={gate && ['RX', 'RY', 'RZ', 'CRX', 'CRY', 'CRZ'].includes(gate) ? "Double-click to edit angle" : undefined}
        >
        {gate ? (
            <div className="relative flex flex-col items-center">
                <Gate id={`placed-${id}`} name={gate} className="shadow-lg w-10 h-10 text-xs" />
                
                {/* Display Value */}
                {params && ['RX', 'RY', 'RZ', 'CRX', 'CRY', 'CRZ'].includes(gate) && !isEditing && (
                    <span
                      className="absolute -bottom-3 text-[9px] font-mono px-1 rounded pointer-events-none whitespace-nowrap z-10"
                      style={{ color: 'var(--accent-primary)', background: 'var(--bg-primary)' }}
                    >
                        {(params[0] / Math.PI).toFixed(2).replace('.00', '')}π
                    </span>
                )}
            </div>
        ) : (
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--snap-dot)' }} />
        )}
        </div>

        {/* Portal for Editor */}
        {isEditing && typeof document !== 'undefined' && createPortal(
            <div 
                id={`editor-portal-${id}`}
                className="fixed z-[9999] shadow-2xl rounded p-2 flex flex-col gap-2 min-w-[140px]"
                style={{ 
                    top: popoverPos.top, 
                    left: popoverPos.left,
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-primary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--border-secondary)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div
                  className="flex items-center gap-1 rounded p-0.5"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                    <button 
                        type="button"
                        onClick={() => setEditUnit('rad')}
                        className="flex-1 text-[9px] py-1 rounded transition-colors font-medium"
                        style={{
                          background: editUnit === 'rad' ? 'var(--accent-primary)' : 'transparent',
                          color: editUnit === 'rad' ? 'white' : 'var(--text-muted)',
                        }}
                    >
                        Rad
                    </button>
                    <button 
                        type="button"
                        onClick={() => setEditUnit('pi')}
                        className="flex-1 text-[9px] py-1 rounded transition-colors font-medium"
                        style={{
                          background: editUnit === 'pi' ? 'var(--accent-primary)' : 'transparent',
                          color: editUnit === 'pi' ? 'white' : 'var(--text-muted)',
                        }}
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
                        className="w-full rounded px-2 py-1 text-xs text-center focus:outline-none"
                        style={{
                          background: 'var(--bg-code)',
                          border: '1px solid var(--border-secondary)',
                          color: 'var(--text-primary)',
                        }}
                        placeholder="Angle..."
                    />
                </div>
                <div className="flex gap-1">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 text-[9px] py-1 rounded transition-colors"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-secondary)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          className="flex-1 text-[9px] py-1 rounded transition-colors text-white"
                          style={{ background: 'var(--accent-green)' }}
                        >
                          Set
                        </button>
                </div>
            </div>,
            document.body
        )}
    </>
  );
};
