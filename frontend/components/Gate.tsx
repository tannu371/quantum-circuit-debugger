'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';

interface GateProps {
  id: string;
  name: string;
  className?: string;
}

export const Gate: React.FC<GateProps> = ({ id, name, className }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: { name },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
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
