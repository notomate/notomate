import React, { useEffect, useRef } from 'react';
import { WhiteboardShapeData } from '../../../../../types/view';
import { Viewport } from '../../tools/types';
import { INK, rectCornerRadius } from '../../ui';

interface ShapeCanvasProps {
    data: WhiteboardShapeData;
    viewport: Viewport;
}

const ShapeCanvas: React.FC<ShapeCanvasProps> = ({ data, viewport }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { x: panX, y: panY, zoom } = viewport;

    if (!data?.position || !data?.dimensions) return null;

    const strokeWidth = data.strokeWidth || 2;
    const padding = strokeWidth + 5;
    const color = data.color || '#000000';

    // World-space bounding box
    let worldLeft: number, worldTop: number, worldWidth: number, worldHeight: number;

    if (data.type === 'rectangle') {
        const x1 = Math.min(data.position.x, data.position.x + data.dimensions.width);
        const y1 = Math.min(data.position.y, data.position.y + data.dimensions.height);
        const x2 = Math.max(data.position.x, data.position.x + data.dimensions.width);
        const y2 = Math.max(data.position.y, data.position.y + data.dimensions.height);
        worldLeft = x1 - padding;
        worldTop = y1 - padding;
        worldWidth = x2 - x1 + padding * 2;
        worldHeight = y2 - y1 + padding * 2;
    } else if (data.type === 'circle') {
        const radius = Math.sqrt(
            Math.pow(data.dimensions.width, 2) + Math.pow(data.dimensions.height, 2)
        );
        worldLeft = data.position.x - radius - padding;
        worldTop = data.position.y - radius - padding;
        worldWidth = radius * 2 + padding * 2;
        worldHeight = radius * 2 + padding * 2;
    } else {
        // line
        const x1 = Math.min(data.position.x, data.position.x + data.dimensions.width);
        const y1 = Math.min(data.position.y, data.position.y + data.dimensions.height);
        const x2 = Math.max(data.position.x, data.position.x + data.dimensions.width);
        const y2 = Math.max(data.position.y, data.position.y + data.dimensions.height);
        worldLeft = x1 - padding;
        worldTop = y1 - padding;
        worldWidth = Math.max(1, x2 - x1) + padding * 2;
        worldHeight = Math.max(1, y2 - y1) + padding * 2;
    }

    const screenLeft = Math.floor(worldLeft * zoom + panX);
    const screenTop = Math.floor(worldTop * zoom + panY);
    const canvasWidth = Math.max(1, Math.ceil(worldWidth * zoom));
    const canvasHeight = Math.max(1, Math.ceil(worldHeight * zoom));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeWidth * zoom;

        // Convert world coords → canvas-local pixels
        const toX = (wx: number) => (wx - worldLeft) * zoom;
        const toY = (wy: number) => (wy - worldTop) * zoom;

        if (data.type === 'rectangle') {
            const rx = toX(Math.min(data.position.x, data.position.x + data.dimensions.width));
            const ry = toY(Math.min(data.position.y, data.position.y + data.dimensions.height));
            const rw = Math.abs(data.dimensions.width) * zoom;
            const rh = Math.abs(data.dimensions.height) * zoom;
            ctx.beginPath();
            if (data.roundness === 'round') {
                ctx.roundRect(rx, ry, rw, rh, rectCornerRadius(data.dimensions.width, data.dimensions.height) * zoom);
            } else {
                ctx.rect(rx, ry, rw, rh);
            }
            if (data.filled) {
                ctx.fillStyle = data.fillColor || color;
                ctx.fill();
            }
            ctx.stroke();
        } else if (data.type === 'circle') {
            const radius = Math.sqrt(
                Math.pow(data.dimensions.width, 2) + Math.pow(data.dimensions.height, 2)
            );
            ctx.beginPath();
            ctx.arc(toX(data.position.x), toY(data.position.y), radius * zoom, 0, 2 * Math.PI);
            if (data.filled) {
                ctx.fillStyle = data.fillColor || color;
                ctx.fill();
            }
            ctx.stroke();
        } else if (data.type === 'line') {
            ctx.beginPath();
            ctx.lineCap = 'round';
            ctx.moveTo(toX(data.position.x), toY(data.position.y));
            ctx.lineTo(
                toX(data.position.x + data.dimensions.width),
                toY(data.position.y + data.dimensions.height)
            );
            ctx.stroke();
        }
    }, [data, zoom]);

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

export default ShapeCanvas;
