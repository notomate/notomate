import { useState, useCallback } from 'react';
import { WhiteboardEdgeData, ConnectionPointType } from '../../../../types/view';
import { WhiteboardObject, Point, generateId } from './types';

/** Curve style for newly drawn edges. */
export const DEFAULT_EDGE_CURVE: WhiteboardEdgeData['curveType'] = 'elbow';

/** Corner style for newly drawn edges. */
export const DEFAULT_EDGE_ROUNDNESS: NonNullable<WhiteboardEdgeData['roundness']> = 'round';

interface UseEdgeToolOptions {
    currentColor: string;
    currentStrokeWidth: number;
    setViewObjects: React.Dispatch<React.SetStateAction<Map<string, WhiteboardObject>>>;
    setSelectedObjectId: (id: string | null) => void;
    sendUpdate: (update: any) => void;
}

interface HoverTarget {
    objectId: string;
    connectionPoint: ConnectionPointType;
    position: Point;
}

interface UseEdgeToolReturn {
    edgeStartPoint: Point | null;
    edgeEndPoint: Point | null;
    isDrawing: boolean;
    edgeStartObjectId: string | null;
    edgeStartConnectionPoint: ConnectionPointType | null;
    hoverTarget: HoverTarget | null;
    startDrawing: (pos: Point, startObjectId?: string | null, startConnectionPoint?: ConnectionPointType | null) => void;
    continueDrawing: (pos: Point, hoverTarget?: HoverTarget | null) => void;
    /** Returns true when an edge was created (false if it was too short). */
    finishDrawing: (endPos: Point, endObjectId?: string | null, endConnectionPoint?: ConnectionPointType | null) => boolean;
    cancelDrawing: () => void;
    renderPreview: (ctx: CanvasRenderingContext2D) => void;
}

export const useEdgeTool = ({
    currentColor,
    currentStrokeWidth,
    setViewObjects,
    setSelectedObjectId,
    sendUpdate
}: UseEdgeToolOptions): UseEdgeToolReturn => {
    const [edgeStartPoint, setEdgeStartPoint] = useState<Point | null>(null);
    const [edgeEndPoint, setEdgeEndPoint] = useState<Point | null>(null);
    const [edgeStartObjectId, setEdgeStartObjectId] = useState<string | null>(null);
    const [edgeStartConnectionPoint, setEdgeStartConnectionPoint] = useState<ConnectionPointType | null>(null);
    const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = useCallback((
        pos: Point,
        startObjectId: string | null = null,
        startConnectionPoint: ConnectionPointType | null = null
    ) => {
        setIsDrawing(true);
        setEdgeStartPoint(pos);
        setEdgeEndPoint(pos);
        setEdgeStartObjectId(startObjectId);
        setEdgeStartConnectionPoint(startConnectionPoint);
    }, []);

    const continueDrawing = useCallback((pos: Point, newHoverTarget: HoverTarget | null = null) => {
        if (isDrawing) {
            // If there's a hover target, snap to it
            if (newHoverTarget) {
                setEdgeEndPoint(newHoverTarget.position);
            } else {
                setEdgeEndPoint(pos);
            }
            setHoverTarget(newHoverTarget);
        }
    }, [isDrawing]);

    const finishDrawing = useCallback((
        endPos: Point,
        endObjectId: string | null = null,
        endConnectionPoint: ConnectionPointType | null = null
    ) => {
        let created = false;
        if (edgeStartPoint) {
            const distance = Math.sqrt(
                Math.pow(endPos.x - edgeStartPoint.x, 2) +
                Math.pow(endPos.y - edgeStartPoint.y, 2)
            );

            // Only create edge if it has meaningful length
            if (distance > 10) {
                const edgeData: WhiteboardEdgeData = {
                    startObjectId: edgeStartObjectId,
                    endObjectId: endObjectId,
                    startConnectionPoint: edgeStartConnectionPoint,
                    endConnectionPoint: endConnectionPoint,
                    startPoint: { ...edgeStartPoint },
                    endPoint: { ...endPos },
                    curveType: DEFAULT_EDGE_CURVE,
                    roundness: DEFAULT_EDGE_ROUNDNESS,
                    arrowType: 'end',
                    lineStyle: 'solid',
                    color: currentColor,
                    strokeWidth: currentStrokeWidth
                };
                const id = generateId();
                const newObject: WhiteboardObject = {
                    id,
                    type: 'whiteboard_edge',
                    name: 'Edge',
                    data: edgeData
                };

                setViewObjects(prev => new Map(prev).set(id, newObject));
                sendUpdate({ type: 'add_view_object', object: newObject });
                setSelectedObjectId(id);
                created = true;
            }
        }

        cancelDrawing();
        return created;
    }, [edgeStartPoint, edgeStartObjectId, edgeStartConnectionPoint, currentColor, currentStrokeWidth, setViewObjects, sendUpdate, setSelectedObjectId]);

    const cancelDrawing = useCallback(() => {
        setIsDrawing(false);
        setEdgeStartPoint(null);
        setEdgeEndPoint(null);
        setEdgeStartObjectId(null);
        setEdgeStartConnectionPoint(null);
        setHoverTarget(null);
    }, []);

    const renderPreview = useCallback((ctx: CanvasRenderingContext2D) => {
        if (!isDrawing || !edgeStartPoint || !edgeEndPoint) return;

        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentStrokeWidth;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(edgeStartPoint.x, edgeStartPoint.y);
        ctx.lineTo(edgeEndPoint.x, edgeEndPoint.y);
        ctx.stroke();

        // Draw arrow preview at end point
        const angle = Math.atan2(edgeEndPoint.y - edgeStartPoint.y, edgeEndPoint.x - edgeStartPoint.x);
        const arrowSize = 10;
        ctx.save();
        ctx.translate(edgeEndPoint.x, edgeEndPoint.y);
        ctx.rotate(angle);
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-arrowSize, arrowSize / 2);
        ctx.lineTo(-arrowSize, -arrowSize / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Draw hover target indicator
        if (hoverTarget) {
            ctx.beginPath();
            ctx.arc(hoverTarget.position.x, hoverTarget.position.y, 12, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.3)'; // Green with transparency
            ctx.fill();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }, [isDrawing, edgeStartPoint, edgeEndPoint, currentColor, currentStrokeWidth, hoverTarget]);

    return {
        edgeStartPoint,
        edgeEndPoint,
        isDrawing,
        edgeStartObjectId,
        edgeStartConnectionPoint,
        hoverTarget,
        startDrawing,
        continueDrawing,
        finishDrawing,
        cancelDrawing,
        renderPreview
    };
};
