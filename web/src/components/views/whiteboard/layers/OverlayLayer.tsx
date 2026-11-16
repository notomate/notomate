import React from 'react';
import { WhiteboardEdgeData, ConnectionPointType } from '../../../../types/view';
import { WhiteboardObject, Viewport, Bounds, Point } from '../tools/types';
import { INK, rectCornerRadius } from '../ui';
import { getEdgePath, getEdgeArrowAngles } from '../objects/edgeGeometry';

interface HoverTarget {
    objectId: string;
    connectionPoint: 'top' | 'bottom' | 'left' | 'right';
    position: Point;
}

interface ShapePreview {
    startPoint: Point;
    currentPoint: Point;
    tool: 'rectangle' | 'circle' | 'line';
}

interface EdgePreview {
    startPoint: Point;
    endPoint: Point;
    hoverTarget: HoverTarget | null;
    color: string;
    strokeWidth: number;
    curveType: WhiteboardEdgeData['curveType'];
    startConnectionPoint: ConnectionPointType | null;
}

interface SelectionBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface OverlayLayerProps {
    viewObjects: Map<string, WhiteboardObject>;
    viewport: Viewport;
    selectedObjectIds: string[];
    selectedBounds: Map<string, Bounds | null>;
    isSelecting: boolean;
    selectionBox: SelectionBox | null;
    shapePreview: ShapePreview | null;
    edgePreview: EdgePreview | null;
    currentColor: string;
    currentStrokeWidth: number;
    currentFill?: string | null;
    currentRoundness?: 'sharp' | 'round';
    /** Connection point an edge endpoint will snap to while being dragged. */
    snapPoint?: Point | null;
}

const computeEdgePath = getEdgePath;
const getArrowAngles = getEdgeArrowAngles;

interface ArrowHeadProps {
    x: number;
    y: number;
    angle: number;
    size: number;
    color: string;
}

const ArrowHead: React.FC<ArrowHeadProps> = ({ x, y, angle, size, color }) => (
    <g transform={`translate(${x},${y}) rotate(${(angle * 180) / Math.PI})`}>
        <polygon points={`0,0 ${-size},${size / 2} ${-size},${-size / 2}`} fill={color} />
    </g>
);

const DASH_PATTERNS: Record<string, string | undefined> = {
    solid: undefined,
    dashed: '10 5',
    dotted: '2 4',
};

const CONNECTION_POINTS: Array<{ key: string; getPos: (b: Bounds) => Point }> = [
    { key: 'top', getPos: b => ({ x: b.x + b.width / 2, y: b.y }) },
    { key: 'bottom', getPos: b => ({ x: b.x + b.width / 2, y: b.y + b.height }) },
    { key: 'left', getPos: b => ({ x: b.x, y: b.y + b.height / 2 }) },
    { key: 'right', getPos: b => ({ x: b.x + b.width, y: b.y + b.height / 2 }) },
];

const CORNERS: Array<{ key: string; getPos: (b: Bounds) => Point }> = [
    { key: 'nw', getPos: b => ({ x: b.x, y: b.y }) },
    { key: 'ne', getPos: b => ({ x: b.x + b.width, y: b.y }) },
    { key: 'sw', getPos: b => ({ x: b.x, y: b.y + b.height }) },
    { key: 'se', getPos: b => ({ x: b.x + b.width, y: b.y + b.height }) },
];

const OverlayLayer: React.FC<OverlayLayerProps> = ({
    viewObjects,
    viewport,
    selectedObjectIds,
    selectedBounds,
    isSelecting,
    selectionBox,
    shapePreview,
    edgePreview,
    currentColor,
    currentStrokeWidth,
    currentFill = null,
    currentRoundness = 'round',
    snapPoint = null,
}) => {
    const zoom = viewport.zoom;
    const arrowSize = 10;
    const handleSize = 8 / zoom;
    const cpRadius = 6 / zoom;
    const strokeInv = 1.5 / zoom;
    const handleRadius = 2 / zoom;
    // Outline padding; capped so handles stay inside checkResizeHandle's 10-unit tolerance
    const selPad = Math.min(6 / zoom, 5);
    const SEL = { stroke: 'var(--primary)' };

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 30 }}
        >
            <defs>
                {/* No global markers — we draw arrows inline for color flexibility */}
            </defs>

            {/* All world-space elements inside the viewport-transformed group */}
            <g transform={`translate(${viewport.x},${viewport.y}) scale(${zoom})`}>

                {/* Edges */}
                {Array.from(viewObjects.entries()).map(([id, obj]) => {
                    if (obj.type !== 'whiteboard_edge') return null;
                    const data = obj.data as WhiteboardEdgeData;
                    if (!data?.startPoint || !data?.endPoint) return null;

                    const color = data.color || '#000000';
                    const sw = data.strokeWidth || 2;
                    const pathD = computeEdgePath(data);
                    const dashPattern = DASH_PATTERNS[data.lineStyle ?? 'solid'];
                    const isSelected = selectedObjectIds.includes(id);
                    const { startAngle, endAngle } = getArrowAngles(data);

                    return (
                        <g key={id}>
                            <g className={INK}>
                            <path
                                d={pathD}
                                stroke={color}
                                strokeWidth={sw}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray={dashPattern}
                            />
                            {/* Arrow heads */}
                            {(data.arrowType === 'start' || data.arrowType === 'both') && (
                                <ArrowHead x={data.startPoint.x} y={data.startPoint.y} angle={startAngle} size={arrowSize} color={color} />
                            )}
                            {(data.arrowType === 'end' || data.arrowType === 'both') && (
                                <ArrowHead x={data.endPoint.x} y={data.endPoint.y} angle={endAngle} size={arrowSize} color={color} />
                            )}
                            </g>
                            {/* Selected edge handles */}
                            {isSelected && (
                                <>
                                    <circle cx={data.startPoint.x} cy={data.startPoint.y} r={handleSize / 2}
                                        fill="#ffffff" style={SEL} strokeWidth={strokeInv} />
                                    <circle cx={data.endPoint.x} cy={data.endPoint.y} r={handleSize / 2}
                                        fill="#ffffff" style={SEL} strokeWidth={strokeInv} />
                                </>
                            )}
                        </g>
                    );
                })}

                {/* Selection handles for non-edge selected objects */}
                {selectedObjectIds.map(id => {
                    const bounds = selectedBounds.get(id);
                    if (!bounds) return null;
                    // Skip edges (handled above) and notes (NoteOverlay renders its own HTML selection UI)
                    const obj = viewObjects.get(id);
                    if (obj?.type === 'whiteboard_edge') return null;
                    if (obj?.type === 'whiteboard_note') return null;

                    return (
                        <g key={`sel-${id}`}>
                            {/* Selection border */}
                            <rect
                                x={bounds.x - selPad}
                                y={bounds.y - selPad}
                                width={bounds.width + selPad * 2}
                                height={bounds.height + selPad * 2}
                                fill="none"
                                style={SEL}
                                strokeWidth={strokeInv}
                            />
                            {/* Corner resize handles */}
                            {CORNERS.map(c => {
                                const p = c.getPos({
                                    x: bounds.x - selPad,
                                    y: bounds.y - selPad,
                                    width: bounds.width + selPad * 2,
                                    height: bounds.height + selPad * 2,
                                });
                                return (
                                    <rect
                                        key={c.key}
                                        x={p.x - handleSize / 2}
                                        y={p.y - handleSize / 2}
                                        width={handleSize}
                                        height={handleSize}
                                        rx={handleRadius}
                                        fill="#ffffff"
                                        style={SEL}
                                        strokeWidth={strokeInv}
                                    />
                                );
                            })}
                            {/* Edge connection points */}
                            {CONNECTION_POINTS.map(cp => {
                                const p = cp.getPos(bounds);
                                return (
                                    <circle
                                        key={cp.key}
                                        cx={p.x}
                                        cy={p.y}
                                        r={cpRadius * 0.75}
                                        fill="#ffffff"
                                        style={SEL}
                                        strokeWidth={strokeInv}
                                        opacity={0.9}
                                    />
                                );
                            })}
                        </g>
                    );
                })}

                {/* Marquee selection box */}
                {isSelecting && selectionBox && (() => {
                    const x = Math.min(selectionBox.startX, selectionBox.currentX);
                    const y = Math.min(selectionBox.startY, selectionBox.currentY);
                    const w = Math.abs(selectionBox.currentX - selectionBox.startX);
                    const h = Math.abs(selectionBox.currentY - selectionBox.startY);
                    return (
                        <rect
                            x={x} y={y} width={w} height={h}
                            style={{ fill: 'color-mix(in srgb, var(--primary) 8%, transparent)', stroke: 'var(--primary)' }}
                            strokeWidth={strokeInv}
                        />
                    );
                })()}

                {/* Shape tool preview */}
                {shapePreview && (() => {
                    const { startPoint: sp, currentPoint: cp, tool } = shapePreview;
                    const previewStyle = {
                        stroke: currentColor,
                        strokeWidth: currentStrokeWidth,
                        fill: tool !== 'line' && currentFill ? currentFill : 'none',
                        strokeLinecap: 'round' as const,
                        className: INK,
                    };
                    if (tool === 'rectangle') {
                        const x = Math.min(sp.x, cp.x);
                        const y = Math.min(sp.y, cp.y);
                        const w = Math.abs(cp.x - sp.x);
                        const h = Math.abs(cp.y - sp.y);
                        const r = currentRoundness === 'round' ? rectCornerRadius(w, h) : 0;
                        return <rect x={x} y={y} width={w} height={h} rx={r} ry={r} {...previewStyle} />;
                    }
                    if (tool === 'circle') {
                        const radius = Math.sqrt(Math.pow(cp.x - sp.x, 2) + Math.pow(cp.y - sp.y, 2));
                        return <circle cx={sp.x} cy={sp.y} r={radius} {...previewStyle} />;
                    }
                    if (tool === 'line') {
                        return <line x1={sp.x} y1={sp.y} x2={cp.x} y2={cp.y} {...previewStyle} />;
                    }
                    return null;
                })()}

                {/* Snap indicator while dragging an edge endpoint */}
                {snapPoint && (
                    <circle
                        cx={snapPoint.x}
                        cy={snapPoint.y}
                        r={12}
                        style={{ fill: 'color-mix(in srgb, var(--primary) 20%, transparent)', stroke: 'var(--primary)' }}
                        strokeWidth={strokeInv * 1.5}
                    />
                )}

                {/* Edge tool preview */}
                {edgePreview && (() => {
                    const { startPoint: sp, endPoint: ep, hoverTarget, color, strokeWidth: sw } = edgePreview;
                    const previewShape = {
                        startPoint: sp,
                        endPoint: ep,
                        curveType: edgePreview.curveType,
                        startConnectionPoint: edgePreview.startConnectionPoint,
                        endConnectionPoint: hoverTarget?.connectionPoint ?? null,
                    };
                    const { endAngle: angle } = getEdgeArrowAngles(previewShape);
                    return (
                        <g>
                            <g className={INK}>
                            <path
                                d={getEdgePath(previewShape)}
                                stroke={color}
                                strokeWidth={sw}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <ArrowHead x={ep.x} y={ep.y} angle={angle} size={arrowSize} color={color} />
                            </g>
                            {/* Snap indicator at hover target */}
                            {hoverTarget && (
                                <circle
                                    cx={hoverTarget.position.x}
                                    cy={hoverTarget.position.y}
                                    r={12}
                                    style={{ fill: 'color-mix(in srgb, var(--primary) 20%, transparent)', stroke: 'var(--primary)' }}
                                    strokeWidth={strokeInv * 1.5}
                                />
                            )}
                        </g>
                    );
                })()}

            </g>
        </svg>
    );
};

export default OverlayLayer;
