import React from 'react';

/**
 * HighLevelCircuitDiagram — renders a polished, textbook-style SVG circuit
 * diagram showing the high-level structure of QAOA or VQE circuits.
 *
 * QAOA: |0⟩ → H⊗n → [cost · mixer] × p layers
 * VQE:  [RY(θ) · CNOT] × d layers
 */

interface Props {
    algorithm: 'QAOA' | 'VQE';
    numQubits: number;
    layers: number;
    id?: string;
}

/* ── layout constants ── */
const WIRE_GAP      = 26;
const BLOCK_W       = 100;
const BLOCK_PAD     = 22;
const GAP_INNER     = 14;
const GAP_LAYER     = 40;
const LABEL_W       = 40;
const MARGIN_X      = 16;
const MARGIN_TOP    = 36;
const MARGIN_BOT    = 60;       // extra room for brace + label text
const BRACE_DROP    = 14;
const BRACE_LABEL_DROP = 28;
const HADAMARD_W    = 60;       // width of the initial H gate block
const HAD_GAP       = 40;       // gap after Hadamard block
const LEAD_GAP      = 24;       // gap before first layer block (wire lead-in)

/* ── palette ── */
const C = {
    costBg:   '#d4f5d0', costBd:   '#7ece75',
    mixerBg:  '#e2d4f5', mixerBd:  '#b593e0',
    ryBg:     '#d0e8f5', ryBd:     '#73b4e0',
    cnotBg:   '#d0f0f0', cnotBd:   '#5cc0c0',
    hadBg:    '#fff3cd', hadBd:    '#e6c547',
    wire:     '#333',
    label:    '#555',
    formula:  '#333',
    brace:    '#777',
    braceLbl: '#555',
    ket:      '#888',
};

export default function HighLevelCircuitDiagram({ algorithm, numQubits, layers, id }: Props) {
    const nWires  = Math.max(numQubits, 2);
    const blockH  = (nWires - 1) * WIRE_GAP + BLOCK_PAD * 2;

    const isQAOA = algorithm === 'QAOA';

    /* X layout computation */
    const x0 = MARGIN_X + LABEL_W;                         // where wires start
    const hadSectionW = isQAOA ? HADAMARD_W + HAD_GAP : 0; // Hadamard only for QAOA
    const layerUnitW  = BLOCK_W + GAP_INNER + BLOCK_W;
    const visLayers   = layers;                             // show ALL layers (no cap)
    const contentW    = LEAD_GAP + hadSectionW + visLayers * layerUnitW + Math.max(0, visLayers - 1) * GAP_LAYER;
    const svgW        = x0 + contentW + MARGIN_X + 8;

    /* Y layout */
    const wiresTopY = MARGIN_TOP + BLOCK_PAD;
    const blockTopY = MARGIN_TOP;
    const svgH      = MARGIN_TOP + blockH + MARGIN_BOT;

    const wireYs = Array.from({ length: nWires }, (_, i) => wiresTopY + i * WIRE_GAP);

    /* colours by algorithm */
    const bg1 = isQAOA ? C.costBg  : C.ryBg;
    const bd1 = isQAOA ? C.costBd  : C.ryBd;
    const bg2 = isQAOA ? C.mixerBg : C.cnotBg;
    const bd2 = isQAOA ? C.mixerBd : C.cnotBd;
    const hdr1 = isQAOA ? 'cost' : 'RY(θ)';
    const hdr2 = isQAOA ? 'mixer' : 'entangle';
    const layerName = isQAOA ? 'QAOA layer' : 'Ansatz layer';

    /* ── render helpers ── */

    /** Render a single unitary block with header + formula tspans */
    const UnitaryBlock = ({
        x, headerLabel, formulaContent, bg, bd, keyPfx,
    }: {
        x: number; headerLabel: string;
        formulaContent: React.ReactNode;
        bg: string; bd: string; keyPfx: string;
    }) => {
        const centerY = blockTopY + blockH / 2;
        return (
            <g key={keyPfx}>
                <rect
                    x={x} y={blockTopY} width={BLOCK_W} height={blockH}
                    rx={8} ry={8}
                    fill={bg} stroke={bd} strokeWidth={2}
                />
                <text
                    x={x + BLOCK_W / 2} y={blockTopY - 10}
                    textAnchor="middle" fontSize={13} fontWeight={600} fill={C.label}
                >
                    {headerLabel}
                </text>
                <text
                    x={x + BLOCK_W / 2}
                    y={centerY + 5}
                    textAnchor="middle" fontSize={16} fontWeight={600}
                    fill={C.formula}
                >
                    {formulaContent}
                </text>
            </g>
        );
    };

    /** Curly brace spanning a layer */
    const LayerBrace = ({ x1, width, layerIdx }: { x1: number; width: number; layerIdx: number }) => {
        const y = blockTopY + blockH + 8;
        const mid = x1 + width / 2;
        const peakY = y + BRACE_DROP;
        return (
            <g>
                <path
                    d={`M ${x1},${y} C ${x1},${y + 8} ${mid - 6},${peakY} ${mid},${peakY}`}
                    fill="none" stroke={C.brace} strokeWidth={1.5}
                />
                <path
                    d={`M ${x1 + width},${y} C ${x1 + width},${y + 8} ${mid + 6},${peakY} ${mid},${peakY}`}
                    fill="none" stroke={C.brace} strokeWidth={1.5}
                />
                <line x1={mid} y1={peakY} x2={mid} y2={peakY + 5} stroke={C.brace} strokeWidth={1.5} />
                <text
                    x={mid} y={peakY + BRACE_LABEL_DROP}
                    textAnchor="middle" fontSize={12} fontWeight={500} fill={C.braceLbl}
                >
                    {layerName} {layerIdx + 1}
                </text>
            </g>
        );
    };

    /* ── build elements ── */

    // Hadamard block (QAOA only)
    const hadX = x0 + LEAD_GAP;
    const hadEl = isQAOA ? (
        <g key="hadamard">
            <rect
                x={hadX} y={blockTopY} width={HADAMARD_W} height={blockH}
                rx={8} ry={8}
                fill={C.hadBg} stroke={C.hadBd} strokeWidth={2}
            />
            <text
                x={hadX + HADAMARD_W / 2} y={blockTopY - 10}
                textAnchor="middle" fontSize={12} fontWeight={600} fill={C.label}
            >
                init
            </text>
            <text
                x={hadX + HADAMARD_W / 2}
                y={blockTopY + blockH / 2 + 6}
                textAnchor="middle" fontSize={20} fontWeight={700} fill={C.formula}
            >
                <tspan>H</tspan>
                <tspan dy="-7" fontSize={10}>⊗{nWires}</tspan>
                <tspan dy="7" fontSize={0}>.</tspan>
            </text>
        </g>
    ) : null;

    // Layer blocks
    const firstLayerX = x0 + LEAD_GAP + hadSectionW;
    const layerEls: React.ReactNode[] = [];

    for (let i = 0; i < visLayers; i++) {
        const lx = firstLayerX + i * (layerUnitW + GAP_LAYER);
        const k = i + 1;
        const sub = subscript(k);

        // Build proper formula content with tspan for superscript
        // Entire −iγₖH_C / −iβₖH_M is the exponent
        const costFormula = isQAOA ? (
            <>
                <tspan>e</tspan>
                <tspan dy="-6" fontSize={11}>−iγ{sub}H</tspan>
                <tspan dy="3" fontSize={6}>C</tspan>
                <tspan dy="6" fontSize={0}>.</tspan>
            </>
        ) : (
            <tspan>Rʏ(θ{sub})</tspan>
        );

        const mixerFormula = isQAOA ? (
            <>
                <tspan>e</tspan>
                <tspan dy="-6" fontSize={11}>−iβ{sub}H</tspan>
                <tspan dy="3" fontSize={6}>M</tspan>
                <tspan dy="6" fontSize={0}>.</tspan>
            </>
        ) : (
            <tspan>CNOT</tspan>
        );

        layerEls.push(
            <g key={`layer-${i}`}>
                <UnitaryBlock x={lx} headerLabel={hdr1} formulaContent={costFormula} bg={bg1} bd={bd1} keyPfx={`b1-${i}`} />
                <UnitaryBlock x={lx + BLOCK_W + GAP_INNER} headerLabel={hdr2} formulaContent={mixerFormula} bg={bg2} bd={bd2} keyPfx={`b2-${i}`} />
                <LayerBrace x1={lx} width={layerUnitW} layerIdx={i} />
            </g>
        );
    }

    return (
        <div id={id} style={{ overflowX: 'auto' }}>
            <svg
                width={svgW} height={svgH}
                viewBox={`0 0 ${svgW} ${svgH}`}
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                    background: '#fafafa',
                    borderRadius: 8,
                }}
            >
                {/* Qubit wires — full width */}
                {wireYs.map((wy, i) => (
                    <line
                        key={`w-${i}`}
                        x1={x0 - 4} y1={wy}
                        x2={svgW - MARGIN_X} y2={wy}
                        stroke={C.wire} strokeWidth={1.8}
                    />
                ))}

                {/* |0⟩ ket labels for QAOA, plain q_i for VQE */}
                {wireYs.map((wy, i) => (
                    <text
                        key={`ql-${i}`}
                        x={x0 - 8} y={wy + 4}
                        textAnchor="end" fontSize={11}
                        fontFamily={isQAOA ? "'Inter', sans-serif" : 'monospace'}
                        fontWeight={500} fill={isQAOA ? C.ket : C.label}
                    >
                        {isQAOA ? '|0⟩' : `q${i}`}
                    </text>
                ))}

                {/* Hadamard block (QAOA) */}
                {hadEl}

                {/* Layer blocks */}
                {layerEls}
            </svg>
        </div>
    );
}

/* ── helpers ── */
function subscript(n: number): string {
    const map = '₀₁₂₃₄₅₆₇₈₉';
    return String(n).split('').map(c => map[parseInt(c)] ?? c).join('');
}
