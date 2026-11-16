import { WhiteboardStrokeData, WhiteboardShapeData, WhiteboardTextData, WhiteboardEdgeData } from '../../../../types/view';
import { CanvasObject, WhiteboardObject } from '../tools/types';
import { distanceToEdge } from './edgeGeometry';

export interface HitResult {
    id: string;
    type: 'canvas' | 'view';
}

/**
 * Find object at the given canvas position
 */
export const findObjectAtPosition = (
    x: number,
    y: number,
    canvasObjects: Map<string, CanvasObject>,
    viewObjects: Map<string, WhiteboardObject>,
    ctx?: CanvasRenderingContext2D | null
): HitResult | null => {
    // Check view objects first (on top)
    for (const [id, obj] of Array.from(viewObjects.entries()).reverse()) {
        try {
            const data = obj.data;

            if (obj.type === 'whiteboard_text') {
                const textData = data as WhiteboardTextData;
                if (ctx) {
                    const fontStyle = textData.fontStyle || 'normal';
                    const fontWeight = textData.fontWeight || 'normal';
                    const fontFamily = textData.fontFamily || 'sans-serif';
                    const fontSize = textData.fontSize || 16;
                    const displayText = textData.text?.trim() || 'Text';
                    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
                    const metrics = ctx.measureText(displayText);
                    if (x >= textData.position.x - 5 && x <= textData.position.x + metrics.width + 5 &&
                        y >= textData.position.y - fontSize - 5 && y <= textData.position.y + 5) {
                        return { id, type: 'view' };
                    }
                }
            } else if (obj.type === 'whiteboard_note' || obj.type === 'whiteboard_view') {
                const posData = data as any;
                const width = posData.width || 200;
                const height = posData.height || 150;
                if (x >= posData.position.x && x <= posData.position.x + width &&
                    y >= posData.position.y && y <= posData.position.y + height) {
                    return { id, type: 'view' };
                }
            } else if (obj.type === 'whiteboard_edge') {
                const edgeData = data as WhiteboardEdgeData;
                if (!edgeData?.startPoint || !edgeData?.endPoint) continue;
                const tolerance = Math.max(5, edgeData.strokeWidth || 2);
                if (distanceToEdge({ x, y }, edgeData) <= tolerance) {
                    return { id, type: 'view' };
                }
            }
        } catch (e) {
            console.error('Error checking view object:', e);
        }
    }

    // Check canvas objects
    for (const [id, obj] of Array.from(canvasObjects.entries()).reverse()) {
        try {
            const data = obj.data;

            if (obj.type === 'stroke') {
                const strokeData = data as WhiteboardStrokeData;
                const minX = Math.min(...strokeData.points.map(p => p.x));
                const maxX = Math.max(...strokeData.points.map(p => p.x));
                const minY = Math.min(...strokeData.points.map(p => p.y));
                const maxY = Math.max(...strokeData.points.map(p => p.y));
                if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) {
                    return { id, type: 'canvas' };
                }
            } else if (obj.type === 'shape') {
                const shapeData = data as WhiteboardShapeData;
                if (shapeData.type === 'rectangle') {
                    if (x >= shapeData.position.x && x <= shapeData.position.x + shapeData.dimensions.width &&
                        y >= shapeData.position.y && y <= shapeData.position.y + shapeData.dimensions.height) {
                        return { id, type: 'canvas' };
                    }
                } else if (shapeData.type === 'circle') {
                    const radius = Math.sqrt(Math.pow(shapeData.dimensions.width, 2) + Math.pow(shapeData.dimensions.height, 2));
                    const dist = Math.sqrt(Math.pow(x - shapeData.position.x, 2) + Math.pow(y - shapeData.position.y, 2));
                    if (dist <= radius + 5) {
                        return { id, type: 'canvas' };
                    }
                } else if (shapeData.type === 'line') {
                    // Line hit detection
                    const start = shapeData.position;
                    const end = { x: start.x + shapeData.dimensions.width, y: start.y + shapeData.dimensions.height };
                    const tolerance = Math.max(5, shapeData.strokeWidth || 2);

                    const lineLength = Math.sqrt(
                        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
                    );

                    if (lineLength > 0) {
                        const t = Math.max(0, Math.min(1,
                            ((x - start.x) * (end.x - start.x) + (y - start.y) * (end.y - start.y)) /
                            (lineLength * lineLength)
                        ));

                        const closestX = start.x + t * (end.x - start.x);
                        const closestY = start.y + t * (end.y - start.y);

                        const distance = Math.sqrt(
                            Math.pow(x - closestX, 2) + Math.pow(y - closestY, 2)
                        );

                        if (distance <= tolerance) {
                            return { id, type: 'canvas' };
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error checking canvas object:', e);
        }
    }
    return null;
};
