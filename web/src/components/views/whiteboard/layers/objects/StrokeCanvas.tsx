import React, { useEffect, useRef } from 'react';
import { WhiteboardStrokeData } from '../../../../../types/view';
import { Viewport } from '../../tools/types';
import { INK } from '../../ui';

interface StrokeCanvasProps {
    data: WhiteboardStrokeData;
    viewport: Viewport;
}

const StrokeCanvas: React.FC<StrokeCanvasProps> = ({ data, viewport }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { x: panX, y: panY, zoom } = viewport;

    const validPoints = data.points.filter(
        p => p && typeof p.x === 'number' && typeof p.y === 'number'
    );

    if (validPoints.length < 2) return null;

    const strokeWidth = data.width || 2;
    const padding = strokeWidth + 5;

    const minX = Math.min(...validPoints.map(p => p.x));
    const maxX = Math.max(...validPoints.map(p => p.x));
    const minY = Math.min(...validPoints.map(p => p.y));
    const maxY = Math.max(...validPoints.map(p => p.y));

    // World-space top-left of canvas bounding box
    const worldLeft = minX - padding;
    const worldTop = minY - padding;

    // Screen position (integer for crisp rendering)
    const screenLeft = Math.floor(worldLeft * zoom + panX);
    const screenTop = Math.floor(worldTop * zoom + panY);

    // Canvas pixel dimensions at current zoom
    const canvasWidth = Math.max(1, Math.ceil((maxX - minX + padding * 2) * zoom));
    const canvasHeight = Math.max(1, Math.ceil((maxY - minY + padding * 2) * zoom));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = data.color || '#000000';
        ctx.lineWidth = strokeWidth * zoom;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        // Convert world coords to canvas-local pixels
        const toLocal = (wx: number, wy: number) => ({
            x: (wx - worldLeft) * zoom,
            y: (wy - worldTop) * zoom,
        });

        const first = toLocal(validPoints[0].x, validPoints[0].y);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < validPoints.length; i++) {
            const pt = toLocal(validPoints[i].x, validPoints[i].y);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }, [data, zoom]); // only re-draw when data or zoom changes; pan only moves CSS position

    return (
        <canvas
            ref={canvasRef}
            className={INK}
            width={canvasWidth}
            height={canvasHeight}
            style={{
                position: 'absolute',
                left: screenLeft,
                top: screenTop,
                pointerEvents: 'none',
            }}
        />
    );
};

export default StrokeCanvas;
