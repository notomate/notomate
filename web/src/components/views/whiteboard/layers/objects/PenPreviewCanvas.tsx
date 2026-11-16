import React, { useEffect, useRef } from 'react';
import { Point } from '../../tools/types';
import { INK } from '../../ui';

interface PenPreviewCanvasProps {
    points: Point[];
    color: string;
    strokeWidth: number;
    viewport: { x: number; y: number; zoom: number };
    width: number;
    height: number;
}

const PenPreviewCanvas: React.FC<PenPreviewCanvasProps> = ({
    points,
    color,
    strokeWidth,
    viewport,
    width,
    height,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (points.length < 2) return;

        ctx.save();
        ctx.translate(viewport.x, viewport.y);
        ctx.scale(viewport.zoom, viewport.zoom);

        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
        ctx.restore();
    });

    return (
        <canvas
            ref={canvasRef}
            className={INK}
            width={width}
            height={height}
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 25,
            }}
        />
    );
};

export default PenPreviewCanvas;
