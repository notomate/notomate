import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WhiteboardTextData, WhiteboardEdgeData, ViewObjectType, ConnectionPointType } from '../../../types/view';
import { useTranslation } from 'react-i18next';
import WhiteboardToolbar from './WhiteboardToolbar';
import WhiteboardToolProperties from './WhiteboardToolProperties';
import AddElementDialog from './AddElementDialog';
import { useWhiteboardCollab } from '../../../hooks/use-whiteboard-collab';
import { Lock, Unlock } from 'lucide-react';

// Import modular tools and utilities
import {
    Tool,
    CanvasObject,
    WhiteboardObject,
    Point,
    Bounds
} from './tools/types';
import { useViewport } from './hooks/useViewport';
import { usePenTool } from './tools/usePenTool';
import { useShapeTool } from './tools/useShapeTool';
import { useEdgeTool } from './tools/useEdgeTool';
import { useTextTool } from './tools/useTextTool';
import { useEraserTool } from './tools/useEraserTool';
import { useSelectTool } from './tools/useSelectTool';
import { findObjectAtPosition } from './objects/hitDetection';
import { getObjectBounds, checkResizeHandle, checkConnectionPoint, getConnectionPointPosition, updateConnectedEdges, findNearestConnectionPoint, findObjectsInSelectionBox } from './objects/bounds';

// Layer components
import BackgroundLayer from './layers/BackgroundLayer';
import MiddleLayer from './layers/MiddleLayer';
import OverlayLayer from './layers/OverlayLayer';
import PenPreviewCanvas from './layers/objects/PenPreviewCanvas';

interface WhiteboardViewComponentProps {
    view?: any;
    isPublic?: boolean;
    readOnly?: boolean;
    workspaceId?: string;
    viewId?: string;
    initialCanvasObjects?: Record<string, any>;
    initialViewObjects?: Record<string, any>;
    disableWebSocket?: boolean;
}

const WhiteboardViewComponent = ({
    isPublic = false,
    readOnly = false,
    workspaceId,
    viewId,
    initialCanvasObjects,
    initialViewObjects,
    disableWebSocket = false
}: WhiteboardViewComponentProps) => {
    const isReadOnly = isPublic || readOnly;
    const { t } = useTranslation();

    // WebSocket integration for real-time sync
    const {
        sendUpdate,
        isConnected,
        canvasObjects: remoteCanvasObjects,
        viewObjects: remoteViewObjects,
        isInitialized
    } = useWhiteboardCollab({
        viewId: viewId || '',
        workspaceId: workspaceId || '',
        enabled: !disableWebSocket && !!viewId && (isPublic || !!workspaceId),
        isPublic: isPublic,
    });

    // Container ref (used for event coordinate mapping and size observation)
    const containerRef = useRef<HTMLDivElement>(null);

    // Hidden canvas ref — provides 2D context for text measurement only
    const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);

    // Canvas state
    const [canvasObjects, setCanvasObjects] = useState<Map<string, CanvasObject>>(new Map());
    const [viewObjects, setViewObjects] = useState<Map<string, WhiteboardObject>>(new Map());

    // Tool state
    const [currentTool, setCurrentTool] = useState<Tool>('select');
    const [currentColor, setCurrentColor] = useState('#000000');
    const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);

    // Lock state
    const [isLocked, setIsLocked] = useState(false);

    // Dialog state
    const [isAddingNote, setIsAddingNote] = useState(false);

    // Canvas size (for PenPreviewCanvas dimensions)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // Viewport hook
    const {
        viewport,
        setViewport,
        isPanning,
        setIsPanning,
        lastPanPoint,
        setLastPanPoint,
        isSpacePressed,
        setIsSpacePressed,
        handleZoomIn,
        handleZoomOut,
        handleResetZoom,
        handlePanMove,
        handleWheelZoom
    } = useViewport();

    // Get hidden canvas 2D context (for text measurement only)
    const getCtx = useCallback(() => {
        return hiddenCanvasRef.current?.getContext('2d') || null;
    }, []);

    // Screen to canvas coordinate conversion
    const screenToCanvas = useCallback((screenX: number, screenY: number): Point => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (screenX - rect.left - viewport.x) / viewport.zoom,
            y: (screenY - rect.top - viewport.y) / viewport.zoom
        };
    }, [viewport]);

    // Tool hooks
    const penTool = usePenTool({
        currentColor,
        currentStrokeWidth,
        setCanvasObjects,
        sendUpdate
    });

    const shapeTool = useShapeTool({
        currentColor,
        currentStrokeWidth,
        setCanvasObjects,
        sendUpdate
    });

    const edgeTool = useEdgeTool({
        currentColor,
        currentStrokeWidth,
        setViewObjects,
        setSelectedObjectId: (id: string | null) => setSelectedObjectIds(id ? [id] : []),
        sendUpdate
    });

    const textTool = useTextTool({
        currentColor,
        defaultText: t('whiteboard.defaultText') || 'Text',
        setViewObjects,
        setSelectedObjectId: (id: string | null) => setSelectedObjectIds(id ? [id] : []),
        sendUpdate
    });

    const eraserTool = useEraserTool({
        canvasObjects,
        setCanvasObjects,
        viewObjects,
        setViewObjects,
        sendUpdate
    });

    const selectTool = useSelectTool({
        canvasObjects,
        setCanvasObjects,
        viewObjects,
        setViewObjects,
        selectedObjectIds,
        setSelectedObjectIds,
        sendUpdate
    });

    // Initialize with API data for public mode
    useEffect(() => {
        if (isPublic && initialCanvasObjects) {
            setCanvasObjects(new Map(Object.entries(initialCanvasObjects)));
        }
    }, [isPublic, initialCanvasObjects]);

    useEffect(() => {
        if (isPublic && initialViewObjects) {
            setViewObjects(new Map(Object.entries(initialViewObjects)));
        }
    }, [isPublic, initialViewObjects]);

    // Sync remote updates to local state (only after WS has synced)
    useEffect(() => {
        if (isInitialized && remoteCanvasObjects) {
            setCanvasObjects(new Map(remoteCanvasObjects));
        }
    }, [isInitialized, remoteCanvasObjects]);

    useEffect(() => {
        if (isInitialized && remoteViewObjects) {
            const convertedMap = new Map<string, WhiteboardObject>();
            remoteViewObjects.forEach((obj, key) => {
                convertedMap.set(key, {
                    id: obj.id,
                    type: obj.type as ViewObjectType,
                    name: obj.name,
                    data: obj.data
                });
            });
            setViewObjects(convertedMap);
        }
    }, [isInitialized, remoteViewObjects]);

    // Observe container size for PenPreviewCanvas
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setCanvasSize({ width, height });
                }
            }
        });

        resizeObserver.observe(container);

        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
            setCanvasSize({ width, height });
        }

        return () => resizeObserver.disconnect();
    }, [isInitialized]);

    // Compute bounds for all selected objects (for OverlayLayer selection handles)
    const selectedBounds = useMemo(() => {
        const ctx = getCtx();
        const map = new Map<string, Bounds | null>();
        selectedObjectIds.forEach(id => {
            map.set(id, getObjectBounds(id, canvasObjects, viewObjects, ctx));
        });
        return map;
    }, [selectedObjectIds, canvasObjects, viewObjects, getCtx]);

    // Derived tool previews for OverlayLayer
    const shapePreview = useMemo(() => {
        if (!shapeTool.isDrawing || !shapeTool.startPoint || !shapeTool.currentPoint) return null;
        if (currentTool !== 'rectangle' && currentTool !== 'circle' && currentTool !== 'line') return null;
        return {
            startPoint: shapeTool.startPoint,
            currentPoint: shapeTool.currentPoint,
            tool: currentTool as 'rectangle' | 'circle' | 'line',
        };
    }, [shapeTool.isDrawing, shapeTool.startPoint, shapeTool.currentPoint, currentTool]);

    const edgePreview = useMemo(() => {
        if (!edgeTool.isDrawing || !edgeTool.edgeStartPoint || !edgeTool.edgeEndPoint) return null;
        return {
            startPoint: edgeTool.edgeStartPoint,
            endPoint: edgeTool.edgeEndPoint,
            hoverTarget: edgeTool.hoverTarget,
            color: currentColor,
            strokeWidth: currentStrokeWidth,
        };
    }, [edgeTool.isDrawing, edgeTool.edgeStartPoint, edgeTool.edgeEndPoint, edgeTool.hoverTarget, currentColor, currentStrokeWidth]);

    // Get pointer position in canvas/world coordinates
    const getPointerPosition = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        let clientX: number, clientY: number;

        if ('touches' in e) {
            const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return screenToCanvas(clientX, clientY);
    };

    // --- Event handlers ---

    const handlePointerDown = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        const pos = getPointerPosition(e);
        if (!pos) return;

        let clientX: number, clientY: number;
        if ('touches' in e) {
            if (e.touches.length === 0) return;
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        // Middle mouse button = pan
        if (e.type === 'mousedown' && (e as React.MouseEvent).button === 1) {
            setIsPanning(true);
            setLastPanPoint({ x: clientX, y: clientY });
            return;
        }

        // Space key pressed = pan mode
        if (isSpacePressed) {
            setIsPanning(true);
            setLastPanPoint({ x: clientX, y: clientY });
            return;
        }

        // In public mode or locked mode, only allow panning
        if (isReadOnly || isLocked) {
            setIsPanning(true);
            setLastPanPoint({ x: clientX, y: clientY });
            return;
        }

        const ctx = getCtx();

        if (currentTool === 'select' || currentTool === 'marquee') {
            const isShiftKey = 'shiftKey' in e && e.shiftKey;

            if (selectedObjectIds.length === 1) {
                const selectedId = selectedObjectIds[0];
                const handle = checkResizeHandle(pos.x, pos.y, selectedId, canvasObjects, viewObjects, ctx);
                if (handle) {
                    const bounds = getObjectBounds(selectedId, canvasObjects, viewObjects, ctx);
                    if (bounds) {
                        selectTool.startResizing(selectedId, handle, pos, bounds);
                        return;
                    }
                }

                const connectionPoint = checkConnectionPoint(pos.x, pos.y, selectedId, canvasObjects, viewObjects, ctx);
                if (connectionPoint) {
                    const startPos = getConnectionPointPosition(selectedId, connectionPoint, canvasObjects, viewObjects, ctx);
                    if (startPos) {
                        edgeTool.startDrawing(startPos, selectedId, connectionPoint);
                        return;
                    }
                }
            }

            const clickedObject = findObjectAtPosition(pos.x, pos.y, canvasObjects, viewObjects, ctx);
            if (clickedObject) {
                const connectionPoint = checkConnectionPoint(pos.x, pos.y, clickedObject.id, canvasObjects, viewObjects, ctx);
                if (connectionPoint) {
                    const startPos = getConnectionPointPosition(clickedObject.id, connectionPoint, canvasObjects, viewObjects, ctx);
                    if (startPos) {
                        setSelectedObjectIds([clickedObject.id]);
                        edgeTool.startDrawing(startPos, clickedObject.id, connectionPoint);
                        return;
                    }
                }

                if (selectedObjectIds.includes(clickedObject.id)) {
                    const handle = checkResizeHandle(pos.x, pos.y, clickedObject.id, canvasObjects, viewObjects, ctx);
                    if (handle) {
                        const bounds = getObjectBounds(clickedObject.id, canvasObjects, viewObjects, ctx);
                        if (bounds) {
                            setSelectedObjectIds([clickedObject.id]);
                            selectTool.startResizing(clickedObject.id, handle, pos, bounds);
                            return;
                        }
                    }
                }

                const isAlreadySelected = selectedObjectIds.includes(clickedObject.id);

                if (isAlreadySelected && isShiftKey) {
                    // Shift-click on selected object = deselect it, no drag
                    selectTool.selectObject(clickedObject.id, true);
                } else if (isAlreadySelected) {
                    // Click on already-selected object = keep all selections, drag all
                    selectTool.startDragging(pos);
                } else if (isShiftKey) {
                    // Shift-click on unselected = add to selection, drag all including new
                    selectTool.selectObject(clickedObject.id, true);
                    selectTool.startDragging(pos, [...selectedObjectIds, clickedObject.id]);
                } else {
                    // Click on unselected object = replace selection, drag only it
                    selectTool.selectObject(clickedObject.id, false);
                    selectTool.startDragging(pos, [clickedObject.id]);
                }
            } else {
                if (currentTool === 'marquee') {
                    if (!isShiftKey) {
                        selectTool.clearSelection();
                    }
                    selectTool.startSelectionBox(pos);
                } else {
                    setSelectedObjectIds([]);
                    setIsPanning(true);
                    setLastPanPoint({ x: clientX, y: clientY });
                }
            }
        } else if (currentTool === 'pen') {
            penTool.startDrawing(pos);
        } else if (currentTool === 'eraser') {
            eraserTool.startErasing();
            const ctx2 = getCtx();
            const objectToErase = findObjectAtPosition(pos.x, pos.y, canvasObjects, viewObjects, ctx2);
            if (objectToErase) {
                eraserTool.eraseObject(objectToErase.id);
            }
        } else if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
            shapeTool.startDrawing(pos);
        } else if (currentTool === 'text') {
            textTool.createText(pos);
        } else if (currentTool === 'note') {
            setIsAddingNote(true);
        } else if (currentTool === 'edge') {
            edgeTool.startDrawing(pos);
        }
    };

    const handlePointerMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPanning && lastPanPoint) {
            let clientX: number, clientY: number;
            if ('touches' in e) {
                if (e.touches.length === 0) return;
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            handlePanMove(clientX, clientY);
            return;
        }

        if (isReadOnly || isLocked) return;

        const pos = getPointerPosition(e);
        if (!pos) return;

        const ctx = getCtx();

        if (selectTool.isSelecting) {
            selectTool.updateSelectionBox(pos);
        } else if (selectTool.isDragging) {
            selectTool.updateDrag(pos);
            if (selectedObjectIds.length > 0) {
                const allUpdatedEdges: WhiteboardObject[] = [];
                selectedObjectIds.forEach(objId => {
                    const updatedEdges = updateConnectedEdges(objId, canvasObjects, viewObjects, ctx);
                    // Don't override edges that are themselves being explicitly dragged
                    allUpdatedEdges.push(...updatedEdges.filter(e => !selectedObjectIds.includes(e.id)));
                });
                if (allUpdatedEdges.length > 0) {
                    setViewObjects(prev => {
                        const newMap = new Map(prev);
                        allUpdatedEdges.forEach(edge => {
                            newMap.set(edge.id, edge);
                        });
                        return newMap;
                    });
                }
            }
        } else if (selectTool.isResizing) {
            selectTool.updateResize(pos);
            if (selectedObjectIds.length > 0) {
                const allUpdatedEdges: WhiteboardObject[] = [];
                selectedObjectIds.forEach(objId => {
                    const updatedEdges = updateConnectedEdges(objId, canvasObjects, viewObjects, ctx);
                    allUpdatedEdges.push(...updatedEdges);
                });
                if (allUpdatedEdges.length > 0) {
                    setViewObjects(prev => {
                        const newMap = new Map(prev);
                        allUpdatedEdges.forEach(edge => {
                            newMap.set(edge.id, edge);
                        });
                        return newMap;
                    });
                }
            }
        } else if (edgeTool.isDrawing) {
            const nearestCP = findNearestConnectionPoint(
                pos.x,
                pos.y,
                canvasObjects,
                viewObjects,
                edgeTool.edgeStartObjectId,
                ctx
            );
            edgeTool.continueDrawing(pos, nearestCP);
        } else if (penTool.isDrawing) {
            penTool.continueDrawing(pos);
        } else if (shapeTool.isDrawing) {
            shapeTool.continueDrawing(pos);
        } else if (eraserTool.isErasing) {
            const objectToErase = findObjectAtPosition(pos.x, pos.y, canvasObjects, viewObjects, ctx);
            if (objectToErase) {
                eraserTool.eraseObject(objectToErase.id);
            }
        }
    };

    const handlePointerUp = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (isPanning) {
            setIsPanning(false);
            setLastPanPoint(null);
            return;
        }

        if (isReadOnly || isLocked) return;

        const pos = getPointerPosition(e);
        const ctx = getCtx();

        if (selectTool.isSelecting) {
            if (selectTool.selectionBox) {
                const box = {
                    x: Math.min(selectTool.selectionBox.startX, selectTool.selectionBox.currentX),
                    y: Math.min(selectTool.selectionBox.startY, selectTool.selectionBox.currentY),
                    width: Math.abs(selectTool.selectionBox.currentX - selectTool.selectionBox.startX),
                    height: Math.abs(selectTool.selectionBox.currentY - selectTool.selectionBox.startY)
                };
                const objectsInBox = findObjectsInSelectionBox(box, canvasObjects, viewObjects, ctx);
                selectTool.finishSelectionBox(objectsInBox);
            } else {
                selectTool.finishSelectionBox([]);
            }
            return;
        }

        if (selectTool.isDragging || selectTool.isResizing) {
            if (selectedObjectIds.length > 0) {
                const allUpdatedEdges: WhiteboardObject[] = [];
                selectedObjectIds.forEach(objId => {
                    const updatedEdges = updateConnectedEdges(objId, canvasObjects, viewObjects, ctx);
                    // Don't override edges that are themselves being explicitly dragged
                    allUpdatedEdges.push(...updatedEdges.filter(e => !selectedObjectIds.includes(e.id)));
                });
                if (allUpdatedEdges.length > 0) {
                    setViewObjects(prev => {
                        const newMap = new Map(prev);
                        allUpdatedEdges.forEach(edge => {
                            newMap.set(edge.id, edge);
                        });
                        return newMap;
                    });
                    allUpdatedEdges.forEach(edge => {
                        sendUpdate({ type: 'update_view_object', object: edge });
                    });
                }
            }
            selectTool.finishDragOrResize();
        } else if (edgeTool.isDrawing) {
            if (pos) {
                let endObjectId: string | null = null;
                let endConnectionPoint: ConnectionPointType | null = null;
                let endPos = pos;

                if (edgeTool.hoverTarget) {
                    endObjectId = edgeTool.hoverTarget.objectId;
                    endConnectionPoint = edgeTool.hoverTarget.connectionPoint;
                    endPos = edgeTool.hoverTarget.position;
                } else {
                    const nearestCP = findNearestConnectionPoint(
                        pos.x,
                        pos.y,
                        canvasObjects,
                        viewObjects,
                        edgeTool.edgeStartObjectId,
                        ctx
                    );
                    if (nearestCP) {
                        endObjectId = nearestCP.objectId;
                        endConnectionPoint = nearestCP.connectionPoint;
                        endPos = nearestCP.position;
                    }
                }

                edgeTool.finishDrawing(endPos, endObjectId, endConnectionPoint);
            } else {
                edgeTool.cancelDrawing();
            }
        } else if (penTool.isDrawing) {
            penTool.finishDrawing();
        } else if (shapeTool.isDrawing) {
            shapeTool.finishDrawing(currentTool);
        } else if (eraserTool.isErasing) {
            eraserTool.finishErasing();
        }
    };

    // Handle wheel for zoom
    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        handleWheelZoom(e.deltaY, mouseX, mouseY);
    };

    // Touch handlers for pinch zoom
    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];

            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            const midX = (touch1.clientX + touch2.clientX) / 2;
            const midY = (touch1.clientY + touch2.clientY) / 2;

            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                (e.currentTarget as any).pinchZoomCenter = {
                    x: touch1.clientX - rect.left,
                    y: touch1.clientY - rect.top
                };
            }

            setLastPanPoint({ x: distance, y: midY });
            (e.currentTarget as any).twoFingerMidpoint = { x: midX, y: midY };
        } else {
            if (currentTool === 'pen' || currentTool === 'eraser' ||
                currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
                e.preventDefault();
            }
            handlePointerDown(e);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];

            const distance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            const midX = (touch1.clientX + touch2.clientX) / 2;
            const midY = (touch1.clientY + touch2.clientY) / 2;

            if (lastPanPoint) {
                const scale = distance / lastPanPoint.x;
                const newZoom = Math.max(0.1, Math.min(5, viewport.zoom * scale));

                const zoomCenter = (e.currentTarget as any).pinchZoomCenter;
                const prevMidpoint = (e.currentTarget as any).twoFingerMidpoint || { x: midX, y: midY };
                const dx = midX - prevMidpoint.x;
                const dy = midY - prevMidpoint.y;

                setViewport(prev => {
                    let newX = prev.x;
                    let newY = prev.y;
                    if (zoomCenter) {
                        const zoomScale = newZoom / prev.zoom;
                        newX = zoomCenter.x - (zoomCenter.x - prev.x) * zoomScale;
                        newY = zoomCenter.y - (zoomCenter.y - prev.y) * zoomScale;
                    }
                    return {
                        ...prev,
                        zoom: newZoom,
                        x: newX + dx,
                        y: newY + dy
                    };
                });

                setLastPanPoint({ x: distance, y: midY });
                (e.currentTarget as any).twoFingerMidpoint = { x: midX, y: midY };
            }
        } else {
            if (penTool.isDrawing || selectTool.isDragging || isPanning) {
                e.preventDefault();
            }
            handlePointerMove(e);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length < 2) {
            setLastPanPoint(null);
            delete (e.currentTarget as any).twoFingerMidpoint;
            delete (e.currentTarget as any).pinchZoomCenter;
        }
        if (e.touches.length === 0) {
            if (penTool.isDrawing || selectTool.isDragging || isPanning) {
                e.preventDefault();
            }
            handlePointerUp(e);
        }
    };

    // Clear all
    const handleClear = () => {
        if (window.confirm(t('whiteboard.clearConfirm') || 'Clear all? This cannot be undone.')) {
            setCanvasObjects(new Map());
            setViewObjects(new Map());
            sendUpdate({ type: 'clear_all' });
        }
    };

    // Delete selected (supports multi-selection)
    const handleDelete = () => {
        if (selectedObjectIds.length === 0) return;
        selectedObjectIds.forEach(id => {
            eraserTool.eraseObject(id);
        });
        setSelectedObjectIds([]);
    };

    // Handle text property updates
    const handleTextPropertyUpdate = useCallback((updates: Partial<WhiteboardTextData>) => {
        if (selectedObjectIds.length === 0) return;
        for (const id of selectedObjectIds) {
            const viewObj = viewObjects.get(id);
            if (viewObj && viewObj.type === 'whiteboard_text') {
                textTool.updateText(id, updates, viewObjects);
                break;
            }
        }
    }, [selectedObjectIds, viewObjects, textTool]);

    // Get selected text data
    const getSelectedTextData = useCallback((): WhiteboardTextData | null => {
        if (selectedObjectIds.length === 0) return null;
        for (const id of selectedObjectIds) {
            const viewObj = viewObjects.get(id);
            if (viewObj && viewObj.type === 'whiteboard_text') {
                return viewObj.data as WhiteboardTextData;
            }
        }
        return null;
    }, [selectedObjectIds, viewObjects]);

    // Handle edge property updates
    const handleEdgePropertyUpdate = useCallback((updates: Partial<WhiteboardEdgeData>) => {
        if (selectedObjectIds.length === 0) return;

        for (const id of selectedObjectIds) {
            const viewObj = viewObjects.get(id);
            if (viewObj && viewObj.type === 'whiteboard_edge') {
                const updatedObj = {
                    ...viewObj,
                    data: {
                        ...viewObj.data,
                        ...updates
                    }
                };
                setViewObjects(prev => new Map(prev).set(id, updatedObj));
                sendUpdate({ type: 'update_view_object', object: updatedObj });
                break;
            }
        }
    }, [selectedObjectIds, viewObjects, sendUpdate]);

    // Get selected edge data
    const getSelectedEdgeData = useCallback((): WhiteboardEdgeData | null => {
        if (selectedObjectIds.length === 0) return null;
        for (const id of selectedObjectIds) {
            const viewObj = viewObjects.get(id);
            if (viewObj && viewObj.type === 'whiteboard_edge') {
                return viewObj.data as WhiteboardEdgeData;
            }
        }
        return null;
    }, [selectedObjectIds, viewObjects]);

    // Get cursor style
    const getCursor = useCallback(() => {
        if (selectTool.isResizing) {
            switch (selectTool.resizeHandle) {
                case 'se': return 'nwse-resize';
                case 'sw': return 'nesw-resize';
                case 'ne': return 'nesw-resize';
                case 'nw': return 'nwse-resize';
                default: return 'default';
            }
        }
        if (selectTool.isDragging) return 'move';
        if (isPanning || isSpacePressed) return 'grab';
        return 'crosshair';
    }, [selectTool.isResizing, selectTool.resizeHandle, selectTool.isDragging, isPanning, isSpacePressed]);

    // Handle note height change from NoteOverlay
    const handleNoteHeightChange = useCallback((viewObjectId: string, height: number) => {
        setViewObjects(prev => {
            const obj = prev.get(viewObjectId);
            if (!obj || obj.type !== 'whiteboard_note') return prev;

            const currentHeight = obj.data?.height;
            if (currentHeight === height) return prev;

            const newMap = new Map(prev);
            newMap.set(viewObjectId, {
                ...obj,
                data: {
                    ...obj.data,
                    height: height
                }
            });
            return newMap;
        });
    }, []);

    // Handle element added from dialog
    const handleElementAdded = useCallback((element: any) => {
        let parsedData = element.data;
        if (typeof parsedData === 'string') {
            try {
                parsedData = JSON.parse(parsedData);
            } catch (e) {
                console.error('Failed to parse element data:', e);
            }
        }

        const newViewObject: WhiteboardObject = {
            id: element.id,
            type: element.type as ViewObjectType,
            name: element.name,
            data: parsedData
        };
        setViewObjects(prev => new Map(prev).set(element.id, newViewObject));
        sendUpdate({ type: 'add_view_object', object: newViewObject });

        if (element.type === 'whiteboard_note') {
            setCurrentTool('select');
        }
    }, [sendUpdate]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Delete' && selectedObjectIds.length > 0) {
                handleDelete();
            } else if (e.key === 'Escape') {
                setSelectedObjectIds([]);
            } else if (e.key === ' ' && !penTool.isDrawing && !selectTool.isDragging && !selectTool.isResizing) {
                e.preventDefault();
                setIsSpacePressed(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ') {
                setIsSpacePressed(false);
                if (isPanning && !selectTool.isDragging) {
                    setIsPanning(false);
                    setLastPanPoint(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedObjectIds, penTool.isDrawing, selectTool.isDragging, selectTool.isResizing, isPanning]);

    // Determine loading state
    const shouldShowLoading = !disableWebSocket && !isInitialized && !(isPublic && initialCanvasObjects && initialViewObjects);

    if (shouldShowLoading) {
        return (
            <div className="relative w-full h-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-neutral-300 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        {t('whiteboard.loading') || 'Loading whiteboard...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div ref={containerRef} className="relative w-full h-full bg-neutral-50 dark:bg-neutral-900 overflow-hidden">

                {/* Hidden canvas for text measurement (ctx only, never displayed) */}
                <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

                {/* [1] Bottom SVG layer — dot grid background */}
                <BackgroundLayer viewport={viewport} />

                {/* [2] Middle HTML layer — strokes, shapes, text, notes */}
                <MiddleLayer
                    canvasObjects={canvasObjects}
                    viewObjects={viewObjects}
                    viewport={viewport}
                    workspaceId={workspaceId}
                    viewId={viewId}
                    isPublic={isPublic}
                    selectedObjectIds={selectedObjectIds}
                    onNoteHeightChange={handleNoteHeightChange}
                />

                {/* Pen preview canvas (outside transform, applies viewport internally) */}
                {penTool.isDrawing && penTool.currentPoints.length >= 2 && (
                    <PenPreviewCanvas
                        points={penTool.currentPoints}
                        color={currentColor}
                        strokeWidth={currentStrokeWidth}
                        viewport={viewport}
                        width={canvasSize.width}
                        height={canvasSize.height}
                    />
                )}

                {/* [3] Top SVG layer — edges, selection handles, tool previews */}
                <OverlayLayer
                    viewObjects={viewObjects}
                    viewport={viewport}
                    selectedObjectIds={selectedObjectIds}
                    selectedBounds={selectedBounds}
                    isSelecting={selectTool.isSelecting}
                    selectionBox={selectTool.selectionBox}
                    shapePreview={shapePreview}
                    edgePreview={edgePreview}
                    currentColor={currentColor}
                    currentStrokeWidth={currentStrokeWidth}
                />

                {/* [4] Event capture div — transparent, captures all pointer events */}
                <div
                    className="absolute inset-0"
                    style={{ zIndex: 40, cursor: getCursor(), touchAction: 'none' }}
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                />

                {/* [5] UI overlay — sync status, zoom controls, toolbar, tool properties */}

                {/* Sync status indicator */}
                {!isReadOnly && (
                    <div className="absolute top-4 right-4 z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-md px-3 py-2 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            isConnected ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className="text-xs text-neutral-600 dark:text-neutral-400">
                            {isConnected ? t('whiteboard.connected') || 'Connected' : t('whiteboard.disconnected') || 'Disconnected'}
                        </span>
                    </div>
                )}

                {/* Zoom controls and lock button */}
                <div className="absolute bottom-24 sm:bottom-4 right-4 z-50 bg-white dark:bg-neutral-800 rounded-lg shadow-md p-2 flex flex-col gap-2">
                    {!isReadOnly && (
                        <>
                            <button
                                onClick={() => setIsLocked(!isLocked)}
                                className={`p-2 rounded transition-colors flex justify-center ${
                                    isLocked
                                        ? 'bg-primary text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                                }`}
                                title={isLocked ? (t('whiteboard.unlock') || 'Unlock') : (t('whiteboard.lock') || 'Lock')}
                            >
                                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                            </button>
                            <div className="border-t border-neutral-200 dark:border-neutral-600 my-1" />
                        </>
                    )}
                    <button
                        onClick={handleZoomIn}
                        className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-sm font-medium"
                        title={t('whiteboard.zoomIn') || 'Zoom In'}
                    >
                        +
                    </button>
                    <button
                        onClick={handleResetZoom}
                        className="p-1 bg-neutral-100 dark:bg-neutral-700 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-xs font-medium"
                        title={t('whiteboard.resetZoom') || 'Reset Zoom'}
                    >
                        {Math.round(viewport.zoom * 100)}%
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-2 bg-neutral-100 dark:bg-neutral-700 rounded hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-sm font-medium"
                        title={t('whiteboard.zoomOut') || 'Zoom Out'}
                    >
                        −
                    </button>
                </div>

                {/* Toolbar and tool properties (hidden when locked or read-only) */}
                {!isLocked && !isReadOnly && (
                    <>
                        <WhiteboardToolbar
                            currentTool={currentTool}
                            setCurrentTool={setCurrentTool}
                            isPublic={isPublic}
                            onClear={handleClear}
                        />

                        <WhiteboardToolProperties
                            currentTool={currentTool}
                            currentColor={currentColor}
                            setCurrentColor={setCurrentColor}
                            currentStrokeWidth={currentStrokeWidth}
                            setCurrentStrokeWidth={setCurrentStrokeWidth}
                            isPublic={isPublic}
                            selectedTextData={getSelectedTextData()}
                            onTextUpdate={handleTextPropertyUpdate}
                            selectedEdgeData={getSelectedEdgeData()}
                            onEdgeUpdate={handleEdgePropertyUpdate}
                        />
                    </>
                )}

                {/* Empty state */}
                {canvasObjects.size === 0 && viewObjects.size === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 35 }}>
                        <div className="text-neutral-400 dark:text-neutral-500">
                            {t('whiteboard.emptyState') || 'Start drawing or add notes'}
                        </div>
                    </div>
                )}
            </div>

            {!isReadOnly && workspaceId && viewId && (
                <AddElementDialog
                    workspaceId={workspaceId}
                    viewId={viewId}
                    isOpen={isAddingNote}
                    onOpenChange={setIsAddingNote}
                    onElementAdded={handleElementAdded}
                />
            )}
        </>
    );
};

export default WhiteboardViewComponent;
