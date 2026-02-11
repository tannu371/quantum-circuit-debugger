import React, { useMemo } from 'react';

/**
 * GraphVisualization — SVG graph renderer for QAOA / Q-Walk results.
 *
 * For QAOA: colors nodes by solution partition (red vs blue from bitstring).
 * For Walk: colors nodes by probability intensity at selected time step.
 */

interface GraphVisualizationProps {
    /** Adjacency matrix (symmetric or upper-triangular). */
    adjacencyMatrix: number[][];
    /** Solution bitstring, e.g. "0110". Bit i → node i partition. */
    solutionBitstring?: string;
    /** Per-vertex probabilities [0..1] for walk / probability mode. */
    probabilities?: number[];
    /** Title displayed above the graph. */
    title?: string;
    /** Width of the SVG canvas. */
    width?: number;
    /** Height of the SVG canvas. */
    height?: number;
    /** Label for "Cluster 0" (e.g. "Set A"). */
    cluster0Label?: string;
    /** Label for "Cluster 1" (e.g. "Set B"). */
    cluster1Label?: string;
}

const CLUSTER_COLORS = {
    '0': '#EF4444',   // red
    '1': '#3B82F6',   // blue
};

function layoutNodes(n: number, width: number, height: number, adjacencyMatrix: number[][]) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 36;

    const side = Math.ceil(Math.sqrt(n));
    const isGrid = n >= 4 && side * side >= n && (() => {
        for (let i = 0; i < n; i++) {
            const r = Math.floor(i / side);
            const c = i % side;
            if (c + 1 < side && i + 1 < n && adjacencyMatrix[i][i + 1] === 0 && adjacencyMatrix[i + 1]?.[i] === 0) {
            }
        }
        return false;
    })();

    if (isGrid) {
        const cellW = (width - 80) / (side - 1 || 1);
        const cellH = (height - 80) / (side - 1 || 1);
        return Array.from({ length: n }, (_, i) => ({
            x: 40 + (i % side) * cellW,
            y: 40 + Math.floor(i / side) * cellH,
        }));
    }

    // Circular layout
    return Array.from({ length: n }, (_, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
        };
    });
}

export default function GraphVisualization({
    adjacencyMatrix,
    solutionBitstring,
    probabilities,
    title,
    width = 300,
    height = 260,
    cluster0Label = 'Cluster 0',
    cluster1Label = 'Cluster 1',
}: GraphVisualizationProps) {
    const n = adjacencyMatrix.length;

    const positions = useMemo(
        () => layoutNodes(n, width, height, adjacencyMatrix),
        [n, width, height, adjacencyMatrix],
    );

    const edges = useMemo(() => {
        const e: { i: number; j: number; w: number; cut: boolean }[] = [];
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const w = Math.abs(adjacencyMatrix[i]?.[j] ?? 0) + Math.abs(adjacencyMatrix[j]?.[i] ?? 0);
                if (w !== 0) {
                    const isCut = solutionBitstring
                        ? solutionBitstring[i] !== solutionBitstring[j]
                        : false;
                    e.push({ i, j, w: Math.abs(adjacencyMatrix[i][j]) || Math.abs(adjacencyMatrix[j][i]), cut: isCut });
                }
            }
        }
        return e;
    }, [adjacencyMatrix, n, solutionBitstring]);

    const nodeColor = (idx: number) => {
        if (solutionBitstring) {
            const bit = solutionBitstring[idx] ?? '0';
            return CLUSTER_COLORS[bit as '0' | '1'] ?? CLUSTER_COLORS['0'];
        }
        if (probabilities) {
            const p = probabilities[idx] ?? 0;
            const r = Math.round(30 + (6 - 30) * p);
            const g = Math.round(30 + (182 - 30) * p);
            const b = Math.round(46 + (212 - 46) * p);
            return `rgb(${r},${g},${b})`;
        }
        return '#6366F1';
    };

    const nodeRadius = Math.max(14, Math.min(22, 160 / n));
    const cutCount = edges.filter(e => e.cut).length;

    return (
        <div
          className="rounded-lg p-3"
          style={{ background: 'var(--bg-code)', border: '1px solid var(--border-primary)' }}
        >
            {title && <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>{title}</p>}
            <svg width={width} height={height} className="mx-auto" viewBox={`0 0 ${width} ${height}`}>
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>

                {/* Edges */}
                {edges.map(({ i, j, cut }) => (
                    <line
                        key={`e-${i}-${j}`}
                        x1={positions[i].x} y1={positions[i].y}
                        x2={positions[j].x} y2={positions[j].y}
                        stroke={cut ? 'var(--accent-yellow)' : 'var(--border-secondary)'}
                        strokeWidth={cut ? 2.5 : 1.5}
                        strokeDasharray={cut ? '6 3' : undefined}
                        opacity={cut ? 1 : 0.6}
                    />
                ))}

                {/* Nodes */}
                {positions.map((pos, i) => (
                    <g key={`n-${i}`} filter="url(#glow)">
                        <circle
                            cx={pos.x} cy={pos.y} r={nodeRadius}
                            fill={nodeColor(i)}
                            stroke={solutionBitstring
                                ? (solutionBitstring[i] === '1' ? '#93C5FD' : '#FCA5A5')
                                : 'var(--border-secondary)'}
                            strokeWidth={2}
                        />
                        <text
                            x={pos.x} y={pos.y}
                            textAnchor="middle" dominantBaseline="central"
                            fill="white" fontSize={nodeRadius > 16 ? 13 : 10}
                            fontWeight="bold" fontFamily="monospace"
                        >
                            {i}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {solutionBitstring && (<>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CLUSTER_COLORS['0'] }}/>
                        {cluster0Label} (bit=0)
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: CLUSTER_COLORS['1'] }}/>
                        {cluster1Label} (bit=1)
                    </span>
                    {cutCount > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--accent-yellow)' }}/>
                            Cut edges ({cutCount})
                        </span>
                    )}
                </>)}
                {probabilities && !solutionBitstring && (
                    <span className="flex items-center gap-1">
                        <span className="w-10 h-2 rounded" style={{
                            background: 'linear-gradient(to right, rgb(30,30,46), rgb(6,182,212))'
                        }}/>
                        Probability
                    </span>
                )}
            </div>
        </div>
    );
}
