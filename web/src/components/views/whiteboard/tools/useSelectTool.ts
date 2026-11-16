import { useState, useCallback, useRef } from 'react';
import { WhiteboardStrokeData, WhiteboardShapeData, WhiteboardTextData, WhiteboardEdgeData } from '../../../../types/view';
import { CanvasObject, WhiteboardObject, Point, Bounds, ResizeHandle } from './types';

interface UseSelectToolOptions {
    canvasObjects: Map<string, CanvasObject>;
    setCanvasObjects: React.Dispatch<React.SetStateAction<Map<string, CanvasObject>>>;
    viewObjects: Map<string, WhiteboardObject>;
    setViewObjects: React.Dispatch<React.SetStateAction<Map<string, WhiteboardObject>>>;
    selectedObjectIds: string[];
    setSelectedObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
    sendUpdate: (update: any) => void;
}

interface SelectionBox {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface UseSelectToolReturn {
    isDragging: boolean;
    isResizing: boolean;
    isSelecting: boolean;
    selectionBox: SelectionBox | null;
    resizeHandle: ResizeHandle | null;
    dragOffset: Point | null;
    startDragging: (pos: Point, explicitIds?: string[]) => void;
    startResizing: (objectId: string, handle: ResizeHandle, pos: Point, bounds: Bounds) => void;
    startSelectionBox: (pos: Point) => void;
    updateDrag: (pos: Point) => void;
    updateResize: (pos: Point) => void;
    updateSelectionBox: (pos: Point) => void;
    finishDragOrResize: () => void;
    finishSelectionBox: (selectedIds: string[]) => void;
    selectObject: (objectId: string, addToSelection?: boolean) => void;
    clearSelection: () => void;
}

export const useSelectTool = ({
    canvasObjects,
    setCanvasObjects,
    viewObjects,
    setViewObjects,
    selectedObjectIds,
    setSelectedObjectIds,
    sendUpdate
}: UseSelectToolOptions): UseSelectToolReturn => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
    const [dragOffset, setDragOffset] = useState<Point | null>(null);
    const [resizeStartBounds, setResizeStartBounds] = useState<Bounds | null>(null);
    const [resizeStartData, setResizeStartData] = useState<any>(null);
    const [resizeObjectId, setResizeObjectId] = useState<string | null>(null);
    // Store original positions for all selected objects when dragging starts
    const [dragStartPositions, setDragStartPositions] = useState<Map<string, Point>>(new Map());
    // Pointer position at drag start; a drag only "counts" once it passes a small threshold,
    // so a plain click on a connected edge doesn't detach it.
    const dragOriginRef = useRef<Point | null>(null);
    const hasMovedRef = useRef(false);

    const selectObject = useCallback((objectId: string, addToSelection: boolean = false) => {
        if (addToSelection) {
            setSelectedObjectIds(prev => {
                if (prev.includes(objectId)) {
                    // Remove if already selected
                    return prev.filter(id => id !== objectId);
                }
                return [...prev, objectId];
            });
        } else {
            setSelectedObjectIds([objectId]);
        }
    }, [setSelectedObjectIds]);

    const clearSelection = useCallback(() => {
        setSelectedObjectIds([]);
    }, [setSelectedObjectIds]);

    const startSelectionBox = useCallback((pos: Point) => {
        setIsSelecting(true);
        setSelectionBox({
            startX: pos.x,
            startY: pos.y,
            currentX: pos.x,
            currentY: pos.y
        });
    }, []);

    const updateSelectionBox = useCallback((pos: Point) => {
        if (isSelecting && selectionBox) {
            setSelectionBox({
                ...selectionBox,
                currentX: pos.x,
                currentY: pos.y
            });
        }
    }, [isSelecting, selectionBox]);

    const finishSelectionBox = useCallback((selectedIds: string[]) => {
        if (selectedIds.length > 0) {
            setSelectedObjectIds(selectedIds);
        }
        setIsSelecting(false);
        setSelectionBox(null);
    }, [setSelectedObjectIds]);

    const getObjectPosition = useCallback((objectId: string): Point | null => {
        const canvasObj = canvasObjects.get(objectId);
        if (canvasObj) {
            if (canvasObj.type === 'stroke') {
                const data = canvasObj.data as WhiteboardStrokeData;
                const minX = Math.min(...data.points.map(p => p.x));
                const minY = Math.min(...data.points.map(p => p.y));
                return { x: minX, y: minY };
            } else if (canvasObj.type === 'shape') {
                const data = canvasObj.data as WhiteboardShapeData;
                return { ...data.position };
            }
        }

        const viewObj = viewObjects.get(objectId);
        if (viewObj) {
            if (viewObj.type === 'whiteboard_edge') {
                const edgeData = viewObj.data as WhiteboardEdgeData;
                if (edgeData?.startPoint) return { ...edgeData.startPoint };
            } else if (viewObj.data?.position) {
                return { ...viewObj.data.position };
            }
        }

        return null;
    }, [canvasObjects, viewObjects]);

    const startDragging = useCallback((pos: Point, explicitIds?: string[]) => {
        const ids = explicitIds ?? selectedObjectIds;
        if (ids.length === 0) return;

        setIsDragging(true);
        dragOriginRef.current = pos;
        hasMovedRef.current = false;

        // Store original positions for all objects to drag
        const positions = new Map<string, Point>();
        ids.forEach(id => {
            const objPos = getObjectPosition(id);
            if (objPos) {
                positions.set(id, objPos);
            }
        });
        setDragStartPositions(positions);

        // Calculate drag offset from the first object
        const firstObjPos = positions.get(ids[0]);
        if (firstObjPos) {
            setDragOffset({
                x: pos.x - firstObjPos.x,
                y: pos.y - firstObjPos.y
            });
        }
    }, [selectedObjectIds, getObjectPosition]);

    const startResizing = useCallback((objectId: string, handle: ResizeHandle, pos: Point, bounds: Bounds) => {
        setSelectedObjectIds([objectId]);
        setIsResizing(true);
        setResizeHandle(handle);
        setResizeStartBounds({ ...bounds });
        setResizeObjectId(objectId);
        setDragOffset({ x: pos.x, y: pos.y });

        // Store original object data for accurate resizing
        const canvasObj = canvasObjects.get(objectId);
        const viewObj = viewObjects.get(objectId);
        if (canvasObj) {
            setResizeStartData(JSON.parse(JSON.stringify(canvasObj.data)));
        } else if (viewObj) {
            setResizeStartData(JSON.parse(JSON.stringify(viewObj.data)));
        }
    }, [setSelectedObjectIds, canvasObjects, viewObjects]);

    const updateDrag = useCallback((pos: Point) => {
        if (!isDragging || !dragOffset || dragStartPositions.size === 0) return;

        if (!hasMovedRef.current) {
            const origin = dragOriginRef.current;
            if (origin && Math.hypot(pos.x - origin.x, pos.y - origin.y) < 3) return;
            hasMovedRef.current = true;
        }

        // Use dragStartPositions keys as source of truth — avoids stale selectedObjectIds closure
        const idsToMove = Array.from(dragStartPositions.keys());
        const firstId = idsToMove[0];
        const firstStartPos = dragStartPositions.get(firstId)!;

        const dx = pos.x - dragOffset.x - firstStartPos.x;
        const dy = pos.y - dragOffset.y - firstStartPos.y;

        idsToMove.forEach(objectId => {
            const startPos = dragStartPositions.get(objectId);
            if (!startPos) return;

            const newPos: Point = {
                x: startPos.x + dx,
                y: startPos.y + dy
            };

            const canvasObj = canvasObjects.get(objectId);
            const viewObj = viewObjects.get(objectId);

            if (canvasObj) {
                const updatedObj = { ...canvasObj };

                if (updatedObj.type === 'stroke') {
                    const data = updatedObj.data as WhiteboardStrokeData;
                    const origMinX = Math.min(...data.points.map(p => p.x));
                    const origMinY = Math.min(...data.points.map(p => p.y));
                    const offsetX = newPos.x - origMinX;
                    const offsetY = newPos.y - origMinY;

                    updatedObj.data = {
                        ...data,
                        points: data.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }))
                    };
                } else if (updatedObj.type === 'shape') {
                    const data = updatedObj.data as WhiteboardShapeData;
                    updatedObj.data = {
                        ...data,
                        position: newPos
                    };
                }

                setCanvasObjects(prev => new Map(prev).set(objectId, updatedObj));
            } else if (viewObj) {
                const updatedObj = { ...viewObj };
                if (viewObj.type === 'whiteboard_edge') {
                    const edgeData = viewObj.data as WhiteboardEdgeData;
                    // endPoint - startPoint vector is constant during drag (both translate by same delta)
                    // so we derive endPoint from newPos + original offset to avoid stale-closure drift
                    const endOffsetX = edgeData.endPoint.x - edgeData.startPoint.x;
                    const endOffsetY = edgeData.endPoint.y - edgeData.startPoint.y;
                    // An end stays attached only if the object it's bound to moves along with
                    // the edge; otherwise detach it, or updateConnectedEdges would snap it back.
                    const keepStart = !!edgeData.startObjectId && dragStartPositions.has(edgeData.startObjectId);
                    const keepEnd = !!edgeData.endObjectId && dragStartPositions.has(edgeData.endObjectId);
                    updatedObj.data = {
                        ...edgeData,
                        startPoint: newPos,
                        endPoint: { x: newPos.x + endOffsetX, y: newPos.y + endOffsetY },
                        // Only the object link is dropped; the side is kept as the elbow's routing hint.
                        ...(keepStart ? {} : { startObjectId: null }),
                        ...(keepEnd ? {} : { endObjectId: null }),
                    };
                } else {
                    updatedObj.data = {
                        ...updatedObj.data,
                        position: newPos,
                    };
                }
                setViewObjects(prev => new Map(prev).set(objectId, updatedObj));
            }
        });
    }, [isDragging, dragOffset, dragStartPositions, canvasObjects, viewObjects, setCanvasObjects, setViewObjects]);

    const updateResize = useCallback((pos: Point) => {
        if (!isResizing || !resizeObjectId || !resizeHandle || !resizeStartBounds || !resizeStartData) return;

        const minSize = 20;

        // Calculate anchor point (the opposite corner that stays fixed)
        let anchorX: number, anchorY: number;
        switch (resizeHandle) {
            case 'se': anchorX = resizeStartBounds.x; anchorY = resizeStartBounds.y; break;
            case 'sw': anchorX = resizeStartBounds.x + resizeStartBounds.width; anchorY = resizeStartBounds.y; break;
            case 'ne': anchorX = resizeStartBounds.x; anchorY = resizeStartBounds.y + resizeStartBounds.height; break;
            case 'nw': anchorX = resizeStartBounds.x + resizeStartBounds.width; anchorY = resizeStartBounds.y + resizeStartBounds.height; break;
        }

        // Calculate new bounds
        let newX: number, newY: number, newWidth: number, newHeight: number;
        switch (resizeHandle) {
            case 'se':
                newWidth = Math.max(minSize, pos.x - anchorX);
                newHeight = Math.max(minSize, pos.y - anchorY);
                newX = anchorX; newY = anchorY;
                break;
            case 'sw':
                newWidth = Math.max(minSize, anchorX - pos.x);
                newHeight = Math.max(minSize, pos.y - anchorY);
                newX = anchorX - newWidth; newY = anchorY;
                break;
            case 'ne':
                newWidth = Math.max(minSize, pos.x - anchorX);
                newHeight = Math.max(minSize, anchorY - pos.y);
                newX = anchorX; newY = anchorY - newHeight;
                break;
            case 'nw':
                newWidth = Math.max(minSize, anchorX - pos.x);
                newHeight = Math.max(minSize, anchorY - pos.y);
                newX = anchorX - newWidth; newY = anchorY - newHeight;
                break;
        }

        const origWidth = Math.max(1, resizeStartBounds.width);
        const origHeight = Math.max(1, resizeStartBounds.height);
        const scaleY = newHeight / origHeight;

        // Check canvas objects
        const canvasObj = canvasObjects.get(resizeObjectId);
        if (canvasObj) {
            const updatedObj = { ...canvasObj };
            const origData = resizeStartData;

            if (canvasObj.type === 'stroke') {
                const strokeData = origData as WhiteboardStrokeData;
                updatedObj.data = {
                    ...strokeData,
                    points: strokeData.points.map(p => ({
                        x: newX + ((p.x - resizeStartBounds.x) / origWidth) * newWidth,
                        y: newY + ((p.y - resizeStartBounds.y) / origHeight) * newHeight
                    }))
                };
            } else if (canvasObj.type === 'shape') {
                const shapeData = origData as WhiteboardShapeData;

                if (shapeData.type === 'rectangle') {
                    updatedObj.data = {
                        ...shapeData,
                        position: { x: newX, y: newY },
                        dimensions: { width: newWidth, height: newHeight }
                    };
                } else if (shapeData.type === 'circle') {
                    const newCenterX = newX + newWidth / 2;
                    const newCenterY = newY + newHeight / 2;
                    const newRadius = Math.min(newWidth, newHeight) / 2;

                    updatedObj.data = {
                        ...shapeData,
                        position: { x: newCenterX, y: newCenterY },
                        dimensions: {
                            width: newRadius,
                            height: 0
                        }
                    };
                } else if (shapeData.type === 'line') {
                    const origStartX = shapeData.position.x;
                    const origStartY = shapeData.position.y;
                    const origEndX = shapeData.position.x + shapeData.dimensions.width;
                    const origEndY = shapeData.position.y + shapeData.dimensions.height;

                    const relStartX = (origStartX - resizeStartBounds.x) / origWidth;
                    const relStartY = (origStartY - resizeStartBounds.y) / origHeight;
                    const relEndX = (origEndX - resizeStartBounds.x) / origWidth;
                    const relEndY = (origEndY - resizeStartBounds.y) / origHeight;

                    const newStartX = newX + relStartX * newWidth;
                    const newStartY = newY + relStartY * newHeight;
                    const newEndX = newX + relEndX * newWidth;
                    const newEndY = newY + relEndY * newHeight;

                    updatedObj.data = {
                        ...shapeData,
                        position: { x: newStartX, y: newStartY },
                        dimensions: {
                            width: newEndX - newStartX,
                            height: newEndY - newStartY
                        }
                    };
                }
            }

            setCanvasObjects(prev => new Map(prev).set(resizeObjectId, updatedObj));
        }

        // Check view objects
        const viewObj = viewObjects.get(resizeObjectId);
        if (viewObj) {
            const updatedObj = { ...viewObj };
            const origData = resizeStartData;

            if (viewObj.type === 'whiteboard_text') {
                const textData = origData as WhiteboardTextData;
                const origFontSize = textData.fontSize || 16;
                const newFontSize = Math.max(8, Math.round(origFontSize * scaleY));

                updatedObj.data = {
                    ...textData,
                    fontSize: newFontSize,
                    position: { x: newX, y: newY + newHeight }
                };
            } else {
                updatedObj.data = {
                    ...origData,
                    width: newWidth,
                    height: newHeight,
                    position: { x: newX, y: newY }
                };
            }
            setViewObjects(prev => new Map(prev).set(resizeObjectId, updatedObj));
        }
    }, [isResizing, resizeObjectId, resizeHandle, resizeStartBounds, resizeStartData, canvasObjects, viewObjects, setCanvasObjects, setViewObjects]);

    const finishDragOrResize = useCallback(() => {
        if (isDragging && dragStartPositions.size > 0 && hasMovedRef.current) {
            // Send updates for all moved objects (use dragStartPositions keys, not selectedObjectIds)
            Array.from(dragStartPositions.keys()).forEach(objectId => {
                const canvasObj = canvasObjects.get(objectId);
                const viewObj = viewObjects.get(objectId);

                if (canvasObj) {
                    sendUpdate({ type: 'update_canvas_object', object: canvasObj });
                } else if (viewObj) {
                    sendUpdate({ type: 'update_view_object', object: viewObj });
                }
            });
        }

        if (isResizing && resizeObjectId) {
            const canvasObj = canvasObjects.get(resizeObjectId);
            const viewObj = viewObjects.get(resizeObjectId);

            if (canvasObj) {
                sendUpdate({ type: 'update_canvas_object', object: canvasObj });
            } else if (viewObj) {
                sendUpdate({ type: 'update_view_object', object: viewObj });
            }
        }

        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setResizeStartBounds(null);
        setResizeStartData(null);
        setResizeObjectId(null);
        setDragOffset(null);
        setDragStartPositions(new Map());
    }, [isDragging, isResizing, dragStartPositions, resizeObjectId, canvasObjects, viewObjects, sendUpdate]);

    return {
        isDragging,
        isResizing,
        isSelecting,
        selectionBox,
        resizeHandle,
        dragOffset,
        startDragging,
        startResizing,
        startSelectionBox,
        updateDrag,
        updateResize,
        updateSelectionBox,
        finishDragOrResize,
        finishSelectionBox,
        selectObject,
        clearSelection
    };
};
