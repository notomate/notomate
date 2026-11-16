import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { WhiteboardTextData, WhiteboardEdgeData, WhiteboardShapeData, WhiteboardStrokeData, WhiteboardTextStyle, ViewObjectType, ConnectionPointType } from '../../../types/view';
import { useTranslation } from 'react-i18next';
import WhiteboardToolbar from './WhiteboardToolbar';
import WhiteboardToolProperties, { DrawingDefaults, ShapeStyle } from './WhiteboardToolProperties';
import WhiteboardShortcutsDialog from './WhiteboardShortcutsDialog';
import AddElementDialog from './AddElementDialog';
import InlineTextEditor from './InlineTextEditor';
import { useWhiteboardCollab } from '../../../hooks/use-whiteboard-collab';
import { Minus, Plus, Maximize, Menu, Trash2, Keyboard, CircleHelp, PenLine, Undo2, Redo2 } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import Tooltip from '@/components/tooltip/Tooltip';
import { ISLAND, ISLAND_BTN, SHAPE_TEXT_SIZE, isTextableShape } from './ui';

const isEditableTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
};

// Import modular tools and utilities
import {
    Tool,
    CanvasObject,
    WhiteboardObject,
    Point,
    Bounds,
    TOOL_SHORTCUTS,
    TOOL_NUMBERS
} from './tools/types';
import { useViewport } from './hooks/useViewport';
import { usePenTool } from './tools/usePenTool';
import { useShapeTool } from './tools/useShapeTool';
import { useEdgeTool, DEFAULT_EDGE_CURVE, DEFAULT_EDGE_ROUNDNESS } from './tools/useEdgeTool';
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
        isInitialized,
        undo,
        redo,
        canUndo,
        canRedo,
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
    const [currentColor, setCurrentColor] = useState('#1e1e1e');
    const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2);
    const [currentFill, setCurrentFill] = useState<string | null>(null);
    const [currentRoundness, setCurrentRoundness] = useState<'sharp' | 'round'>('round');
    const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);

    // Dragging one end of a selected edge (to move it or re-attach it to another object)
    const [endpointDrag, setEndpointDrag] = useState<{
        edgeId: string;
        end: 'start' | 'end';
        snap: { objectId: string; connectionPoint: ConnectionPointType; position: Point } | null;
    } | null>(null);

    // Object whose text is being edited in place (shape label or text object)
    const [editing, setEditing] = useState<{ id: string; kind: 'shape' | 'text' } | null>(null);

    // Lock state
    const [isLocked, setIsLocked] = useState(false);

    // Dialog state
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);

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
        currentFill,
        currentRoundness,
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

    // Picking a drawing tool clears the selection, so the panel shows that tool's defaults
    useEffect(() => {
        if (currentTool !== 'select' && currentTool !== 'hand') {
            setSelectedObjectIds([]);
        }
    }, [currentTool]);

    // Drop selected ids whose objects no longer exist (after undo/redo or a remote delete)
    useEffect(() => {
        setSelectedObjectIds(prev => {
            const next = prev.filter(id => canvasObjects.has(id) || viewObjects.has(id));
            return next.length === prev.length ? prev : next;
        });
        setEditing(prev => (prev && !canvasObjects.has(prev.id) && !viewObjects.has(prev.id) ? null : prev));
    }, [canvasObjects, viewObjects]);

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
            curveType: DEFAULT_EDGE_CURVE,
            roundness: DEFAULT_EDGE_ROUNDNESS,
            startConnectionPoint: edgeTool.edgeStartConnectionPoint,
        };
    }, [edgeTool.isDrawing, edgeTool.edgeStartPoint, edgeTool.edgeEndPoint, edgeTool.hoverTarget, edgeTool.edgeStartConnectionPoint, currentColor, currentStrokeWidth]);

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

        // Read-only, locked or hand tool: only allow panning
        if (isReadOnly || isLocked || currentTool === 'hand') {
            setIsPanning(true);
            setLastPanPoint({ x: clientX, y: clientY });
            return;
        }

        const ctx = getCtx();

        if (currentTool === 'select' || currentTool === 'marquee') {
            const isShiftKey = 'shiftKey' in e && e.shiftKey;

            // Grab an endpoint handle of the selected edge
            if (selectedObjectIds.length === 1) {
                const edge = viewObjects.get(selectedObjectIds[0]);
                if (edge?.type === 'whiteboard_edge') {
                    const d = edge.data as WhiteboardEdgeData;
                    const hitRadius = 10 / viewport.zoom;
                    const near = (p: Point) => Math.hypot(pos.x - p.x, pos.y - p.y) <= hitRadius;
                    const end = near(d.endPoint) ? 'end' : near(d.startPoint) ? 'start' : null;
                    if (end) {
                        setEndpointDrag({ edgeId: edge.id, end, snap: null });
                        return;
                    }
                }
            }

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
                if (!isShiftKey) {
                    selectTool.clearSelection();
                }
                selectTool.startSelectionBox(pos);
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
            // Keep the click from stealing focus from the editor that opens below
            e.preventDefault();
            const id = textTool.createText(pos);
            setCurrentTool('select');
            setEditing({ id, kind: 'text' });
        } else if (currentTool === 'note') {
            setIsAddingNote(true);
        } else if (currentTool === 'edge') {
            // Snap the arrow's start onto a nearby connection point, if any
            const startCP = findNearestConnectionPoint(pos.x, pos.y, canvasObjects, viewObjects, null, ctx);
            if (startCP) {
                edgeTool.startDrawing(startCP.position, startCP.objectId, startCP.connectionPoint);
            } else {
                edgeTool.startDrawing(pos);
            }
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

        if (endpointDrag) {
            const edge = viewObjects.get(endpointDrag.edgeId);
            if (!edge) return;
            const d = edge.data as WhiteboardEdgeData;
            const otherObjectId = endpointDrag.end === 'start' ? d.endObjectId : d.startObjectId;
            const snap = findNearestConnectionPoint(pos.x, pos.y, canvasObjects, viewObjects, otherObjectId ?? null, ctx);
            const point = snap ? snap.position : pos;
            const updated: WhiteboardObject = {
                ...edge,
                data: endpointDrag.end === 'start'
                    ? { ...d, startPoint: point, startConnectionPoint: snap?.connectionPoint ?? null }
                    : { ...d, endPoint: point, endConnectionPoint: snap?.connectionPoint ?? null },
            };
            setViewObjects(prev => new Map(prev).set(edge.id, updated));
            setEndpointDrag({ ...endpointDrag, snap });
            return;
        }

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

        if (endpointDrag) {
            const edge = viewObjects.get(endpointDrag.edgeId);
            if (edge) {
                const d = edge.data as WhiteboardEdgeData;
                const snap = endpointDrag.snap;
                const updated: WhiteboardObject = {
                    ...edge,
                    data: endpointDrag.end === 'start'
                        ? {
                            ...d,
                            startPoint: snap ? snap.position : d.startPoint,
                            startObjectId: snap?.objectId ?? null,
                            startConnectionPoint: snap?.connectionPoint ?? null,
                        }
                        : {
                            ...d,
                            endPoint: snap ? snap.position : d.endPoint,
                            endObjectId: snap?.objectId ?? null,
                            endConnectionPoint: snap?.connectionPoint ?? null,
                        },
                };
                setViewObjects(prev => new Map(prev).set(edge.id, updated));
                sendUpdate({ type: 'update_view_object', object: updated });
            }
            setEndpointDrag(null);
            return;
        }

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

                const created = edgeTool.finishDrawing(endPos, endObjectId, endConnectionPoint);
                // Back to Select after drawing an arrow (it is already selected)
                if (created) setCurrentTool('select');
            } else {
                edgeTool.cancelDrawing();
            }
        } else if (penTool.isDrawing) {
            penTool.finishDrawing();
        } else if (shapeTool.isDrawing) {
            const shapeId = shapeTool.finishDrawing(currentTool);
            // Back to Select with the new shape selected, ready to move / restyle
            if (shapeId) {
                setSelectedObjectIds([shapeId]);
                setCurrentTool('select');
            }
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
            if (currentTool === 'pen' || currentTool === 'eraser' || currentTool === 'text' ||
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
            if (penTool.isDrawing || selectTool.isDragging || endpointDrag || isPanning) {
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
            if (penTool.isDrawing || selectTool.isDragging || endpointDrag || isPanning) {
                e.preventDefault();
            }
            handlePointerUp(e);
        }
    };

    /** Opens the inline editor for a shape (rectangle / circle) or text object; false if it takes no text. */
    const startTextEdit = (id: string): boolean => {
        const shape = canvasObjects.get(id);
        if (shape?.type === 'shape' && isTextableShape(shape.data as WhiteboardShapeData)) {
            setSelectedObjectIds([id]);
            setEditing({ id, kind: 'shape' });
            return true;
        }
        if (viewObjects.get(id)?.type === 'whiteboard_text') {
            setSelectedObjectIds([id]);
            setEditing({ id, kind: 'text' });
            return true;
        }
        return false;
    };

    const commitTextEdit = (text: string) => {
        if (!editing) return;
        const { id, kind } = editing;
        setEditing(null);
        if (kind === 'shape') {
            const obj = canvasObjects.get(id);
            if (!obj || obj.type !== 'shape') return;
            const d = obj.data as WhiteboardShapeData;
            if ((d.text ?? '') === text) return;
            const updated: CanvasObject = { ...obj, data: { ...d, text } };
            setCanvasObjects(prev => new Map(prev).set(id, updated));
            sendUpdate({ type: 'update_canvas_object', object: updated });
        } else {
            const obj = viewObjects.get(id);
            if (!obj || obj.type !== 'whiteboard_text') return;
            if (!text.trim()) {
                // An empty text object is just noise: drop it
                eraserTool.eraseObject(id);
                setSelectedObjectIds(prev => prev.filter(x => x !== id));
            } else if ((obj.data as WhiteboardTextData).text !== text) {
                textTool.updateText(id, { text }, viewObjects);
            }
        }
    };

    // Double-click: edit the text of a shape / text object, or add text on empty canvas
    const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly || isLocked || currentTool !== 'select' || isSpacePressed) return;
        const pos = screenToCanvas(e.clientX, e.clientY);
        const hit = findObjectAtPosition(pos.x, pos.y, canvasObjects, viewObjects, getCtx());
        if (hit) {
            startTextEdit(hit.id);
            return;
        }
        // Centre the new line of text on the pointer (its position is the baseline)
        const id = textTool.createText({ x: pos.x, y: pos.y + 12 });
        setEditing({ id, kind: 'text' });
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

    // Style of the selected strokes / shapes (first one wins), for the property panel
    const selectedShapeStyle = useMemo((): ShapeStyle | null => {
        let style: ShapeStyle | null = null;
        let fillable = false;
        let roundable = false;
        let roundness: 'sharp' | 'round' | undefined;
        let textStyle: WhiteboardTextStyle | null = null;
        for (const id of selectedObjectIds) {
            const obj = canvasObjects.get(id);
            if (!obj) continue;
            if (obj.type === 'shape') {
                const d = obj.data as WhiteboardShapeData;
                if (d.type !== 'line') fillable = true;
                if (d.type === 'rectangle') {
                    roundable = true;
                    roundness ??= d.roundness ?? 'sharp';
                }
                if (isTextableShape(d)) {
                    textStyle ??= {
                        fontSize: d.fontSize || SHAPE_TEXT_SIZE,
                        fontFamily: d.fontFamily || 'sans-serif',
                        fontWeight: d.fontWeight || 'normal',
                        fontStyle: d.fontStyle || 'normal',
                        textDecoration: d.textDecoration || 'none',
                    };
                }
                style ??= {
                    color: d.color,
                    strokeWidth: d.strokeWidth,
                    fill: d.filled ? (d.fillColor || d.color) : null,
                    fillable: false,
                    roundness: 'sharp',
                    roundable: false,
                    textStyle: null,
                };
            } else {
                const d = obj.data as WhiteboardStrokeData;
                style ??= { color: d.color, strokeWidth: d.width, fill: null, fillable: false, roundness: 'sharp', roundable: false, textStyle: null };
            }
        }
        return style ? { ...style, fillable, roundable, roundness: roundness ?? 'sharp', textStyle } : null;
    }, [selectedObjectIds, canvasObjects]);

    // Apply colour / width / fill to every selected stroke and shape
    const handleShapeStyleUpdate = useCallback((updates: Partial<DrawingDefaults>) => {
        const changed: CanvasObject[] = [];
        selectedObjectIds.forEach(id => {
            const obj = canvasObjects.get(id);
            if (!obj) return;
            if (obj.type === 'shape') {
                const d = obj.data as WhiteboardShapeData;
                const next: WhiteboardShapeData = { ...d };
                if (updates.color !== undefined) next.color = updates.color;
                if (updates.strokeWidth !== undefined) next.strokeWidth = updates.strokeWidth;
                if (updates.fill !== undefined && d.type !== 'line') {
                    next.filled = updates.fill !== null;
                    next.fillColor = updates.fill ?? undefined;
                }
                if (updates.roundness !== undefined && d.type === 'rectangle') {
                    next.roundness = updates.roundness;
                }
                changed.push({ ...obj, data: next });
            } else {
                const d = obj.data as WhiteboardStrokeData;
                const next: WhiteboardStrokeData = { ...d };
                if (updates.color !== undefined) next.color = updates.color;
                if (updates.strokeWidth !== undefined) next.width = updates.strokeWidth;
                changed.push({ ...obj, data: next });
            }
        });
        if (changed.length === 0) return;
        setCanvasObjects(prev => {
            const m = new Map(prev);
            changed.forEach(o => m.set(o.id, o));
            return m;
        });
        changed.forEach(o => sendUpdate({ type: 'update_canvas_object', object: o }));
    }, [selectedObjectIds, canvasObjects, sendUpdate]);

    // Apply font settings to the labels of every selected rectangle / circle
    const handleShapeTextUpdate = useCallback((updates: Partial<WhiteboardTextStyle>) => {
        const changed: CanvasObject[] = [];
        selectedObjectIds.forEach(id => {
            const obj = canvasObjects.get(id);
            if (obj?.type !== 'shape' || !isTextableShape(obj.data as WhiteboardShapeData)) return;
            changed.push({ ...obj, data: { ...obj.data, ...updates } });
        });
        if (changed.length === 0) return;
        setCanvasObjects(prev => {
            const m = new Map(prev);
            changed.forEach(o => m.set(o.id, o));
            return m;
        });
        changed.forEach(o => sendUpdate({ type: 'update_canvas_object', object: o }));
    }, [selectedObjectIds, canvasObjects, sendUpdate]);

    const handleDefaultsChange = useCallback((updates: Partial<DrawingDefaults>) => {
        if (updates.color !== undefined) setCurrentColor(updates.color);
        if (updates.strokeWidth !== undefined) setCurrentStrokeWidth(updates.strokeWidth);
        if (updates.fill !== undefined) setCurrentFill(updates.fill);
        if (updates.roundness !== undefined) setCurrentRoundness(updates.roundness);
    }, []);

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
        if (endpointDrag) return 'grabbing';
        if (isPanning) return 'grabbing';
        if (isSpacePressed || isReadOnly || isLocked || currentTool === 'hand') return 'grab';
        switch (currentTool) {
            case 'select':
            case 'marquee':
            case 'note':
                return 'default';
            case 'text':
                return 'text';
            default:
                return 'crosshair';
        }
    }, [selectTool.isResizing, selectTool.resizeHandle, selectTool.isDragging, endpointDrag, isPanning, isSpacePressed, isReadOnly, isLocked, currentTool]);

    // Fit all content into the visible area
    const handleFitToContent = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const ctx = getCtx();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const ids = [...canvasObjects.keys(), ...viewObjects.keys()];
        ids.forEach(id => {
            const b = getObjectBounds(id, canvasObjects, viewObjects, ctx);
            if (!b) return;
            minX = Math.min(minX, b.x, b.x + b.width);
            minY = Math.min(minY, b.y, b.y + b.height);
            maxX = Math.max(maxX, b.x, b.x + b.width);
            maxY = Math.max(maxY, b.y, b.y + b.height);
        });
        if (!isFinite(minX)) {
            handleResetZoom();
            return;
        }
        const { width, height } = container.getBoundingClientRect();
        const padding = 80;
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const zoom = Math.max(0.1, Math.min(2, Math.min((width - padding * 2) / contentW, (height - padding * 2) / contentH)));
        setViewport({
            zoom,
            x: width / 2 - (minX + contentW / 2) * zoom,
            y: height / 2 - (minY + contentH / 2) * zoom,
        });
    }, [canvasObjects, viewObjects, getCtx, handleResetZoom, setViewport]);

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

        setCurrentTool('select');
        setSelectedObjectIds([element.id]);
    }, [sendUpdate]);

    // True while a pointer gesture is mid-way; undo/redo would fight with it
    const isInteracting = penTool.isDrawing || shapeTool.isDrawing || edgeTool.isDrawing ||
        selectTool.isDragging || selectTool.isResizing || selectTool.isSelecting || !!endpointDrag;

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Never hijack keys while the user is typing (property panel, notes, dialogs)
            if (isEditableTarget(e.target)) return;

            if (e.key === 'Enter' && selectedObjectIds.length === 1 && !isReadOnly && !isLocked && !isInteracting) {
                if (startTextEdit(selectedObjectIds[0])) e.preventDefault();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIds.length > 0 && !isReadOnly && !isLocked) {
                e.preventDefault();
                handleDelete();
            } else if (e.key === 'Escape') {
                setSelectedObjectIds([]);
            } else if (e.key === '?') {
                setShowShortcuts(v => !v);
            } else if (e.key === ' ' && !penTool.isDrawing && !selectTool.isDragging && !selectTool.isResizing) {
                e.preventDefault();
                setIsSpacePressed(true);
            } else if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
                e.preventDefault();
                if (isReadOnly || isLocked || isInteracting) return;
                const isRedo = e.key.toLowerCase() === 'y' || e.shiftKey;
                if (isRedo) redo(); else undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                handleZoomIn();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                handleZoomOut();
            } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                handleResetZoom();
            } else if (e.shiftKey && e.code === 'Digit1') {
                handleFitToContent();
            } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !isReadOnly && !isLocked) {
                const key = e.key.toUpperCase();
                const tools = Object.keys(TOOL_SHORTCUTS) as Tool[];
                const tool = tools.find(k => TOOL_SHORTCUTS[k] === key || TOOL_NUMBERS[k] === key);
                if (tool) setCurrentTool(tool);
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
    }, [selectedObjectIds, canvasObjects, viewObjects, penTool.isDrawing, selectTool.isDragging, selectTool.isResizing, isPanning, isReadOnly, isLocked, isInteracting, undo, redo, handleZoomIn, handleZoomOut, handleResetZoom, handleFitToContent]);

    // Determine loading state
    const shouldShowLoading = !disableWebSocket && !isInitialized && !(isPublic && initialCanvasObjects && initialViewObjects);

    if (shouldShowLoading) {
        return (
            <div className="relative w-full h-full bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-neutral-300 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm text-muted-foreground">
                        {t('whiteboard.loading') || 'Loading whiteboard...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div ref={containerRef} className="relative isolate w-full h-full bg-neutral-50 dark:bg-neutral-900 overflow-hidden">

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
                    editingId={editing?.id ?? null}
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
                    currentFill={currentFill}
                    currentRoundness={currentRoundness}
                    snapPoint={endpointDrag?.snap?.position ?? null}
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
                    onDoubleClick={handleDoubleClick}
                />

                {/* In-place text editor for a shape label or text object */}
                {editing && !isReadOnly && (() => {
                    if (editing.kind === 'shape') {
                        const obj = canvasObjects.get(editing.id);
                        if (obj?.type !== 'shape') return null;
                        return <InlineTextEditor key={editing.id} kind="shape" data={obj.data as WhiteboardShapeData} viewport={viewport} onCommit={commitTextEdit} />;
                    }
                    const obj = viewObjects.get(editing.id);
                    if (obj?.type !== 'whiteboard_text') return null;
                    return <InlineTextEditor key={editing.id} kind="text" data={obj.data as WhiteboardTextData} viewport={viewport} onCommit={commitTextEdit} />;
                })()}

                {/* [5] UI overlay — sync status, zoom controls, toolbar, tool properties */}

                {/* Sync status — quiet dot when connected, explicit badge when not */}
                {!isReadOnly && (
                    <Tooltip text={isConnected ? t('whiteboard.connected') : t('whiteboard.disconnected')} side="left">
                        <div
                            className={`absolute top-3 right-3 z-50 flex h-9 items-center gap-2 px-3 ${ISLAND} ${
                                isConnected ? '' : '!bg-red-50 dark:!bg-red-950/80'
                            }`}
                            role="status"
                        >
                            <span className="relative flex h-2 w-2">
                                {!isConnected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />}
                                <span className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            </span>
                            {!isConnected && (
                                <span className="text-xs font-medium text-red-600 dark:text-red-400">
                                    {t('whiteboard.disconnected')}
                                </span>
                            )}
                        </div>
                    </Tooltip>
                )}

                {/* Main menu (top-left) */}
                {!isReadOnly && (
                    <DropdownMenu.Root>
                        <Tooltip text={t('whiteboard.menu')} side="right">
                            <DropdownMenu.Trigger asChild>
                                <button
                                    type="button"
                                    aria-label={t('whiteboard.menu')}
                                    className={`absolute left-3 top-3 z-50 ${ISLAND} ${ISLAND_BTN} data-[state=open]:bg-primary-light`}
                                >
                                    <Menu size={17} strokeWidth={1.75} />
                                </button>
                            </DropdownMenu.Trigger>
                        </Tooltip>
                        <DropdownMenu.Portal>
                            <DropdownMenu.Content
                                align="start"
                                sideOffset={8}
                                className={`${ISLAND} z-popover min-w-[13rem] p-1.5 text-sm`}
                            >
                                <DropdownMenu.Item className={menuItem} onSelect={handleFitToContent}>
                                    <Maximize size={15} />
                                    <span className="flex-1">{t('whiteboard.fitToScreen')}</span>
                                    <kbd className={kbd}>Shift 1</kbd>
                                </DropdownMenu.Item>
                                <DropdownMenu.Item className={menuItem} onSelect={() => setShowShortcuts(true)}>
                                    <Keyboard size={15} />
                                    <span className="flex-1">{t('whiteboard.shortcuts')}</span>
                                    <kbd className={kbd}>?</kbd>
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="my-1 h-px bg-neutral-200 dark:bg-neutral-700" />
                                <DropdownMenu.Item
                                    className={`${menuItem} text-red-600 data-[highlighted]:bg-red-50 dark:text-red-400 dark:data-[highlighted]:bg-red-900/30`}
                                    onSelect={handleClear}
                                    disabled={isLocked}
                                >
                                    <Trash2 size={15} />
                                    <span className="flex-1">{t('whiteboard.clear')}</span>
                                </DropdownMenu.Item>
                            </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                )}

                {/* Zoom + undo/redo controls (bottom-left) */}
                <div className="absolute bottom-[4.25rem] sm:bottom-3 left-3 z-50 flex items-center gap-2">
                <div className={`flex items-center p-1 ${ISLAND}`}>
                    <Tooltip text={`${t('whiteboard.zoomOut')} (Ctrl −)`} side="top">
                        <button type="button" onClick={handleZoomOut} aria-label={t('whiteboard.zoomOut')} className={`${ISLAND_BTN} !h-8 !w-8`}>
                            <Minus size={15} />
                        </button>
                    </Tooltip>
                    <Tooltip text={`${t('whiteboard.resetZoom')} (Ctrl 0)`} side="top">
                        <button
                            type="button"
                            onClick={handleResetZoom}
                            className="h-8 min-w-[3.5rem] rounded-md px-1 text-xs font-medium tabular-nums text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-700"
                        >
                            {Math.round(viewport.zoom * 100)}%
                        </button>
                    </Tooltip>
                    <Tooltip text={`${t('whiteboard.zoomIn')} (Ctrl +)`} side="top">
                        <button type="button" onClick={handleZoomIn} aria-label={t('whiteboard.zoomIn')} className={`${ISLAND_BTN} !h-8 !w-8`}>
                            <Plus size={15} />
                        </button>
                    </Tooltip>
                    <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
                    <Tooltip text={`${t('whiteboard.fitToScreen')} (Shift 1)`} side="top">
                        <button type="button" onClick={handleFitToContent} aria-label={t('whiteboard.fitToScreen')} className={`${ISLAND_BTN} !h-8 !w-8`}>
                            <Maximize size={14} />
                        </button>
                    </Tooltip>
                </div>
                {!isReadOnly && (
                    <div className={`flex items-center p-1 ${ISLAND}`}>
                        <Tooltip text={`${t('whiteboard.undo')} (Ctrl Z)`} side="top">
                            <button
                                type="button"
                                onClick={undo}
                                disabled={!canUndo || isLocked}
                                aria-label={t('whiteboard.undo')}
                                className={`${ISLAND_BTN} !h-8 !w-8`}
                            >
                                <Undo2 size={15} />
                            </button>
                        </Tooltip>
                        <Tooltip text={`${t('whiteboard.redo')} (Ctrl Shift Z)`} side="top">
                            <button
                                type="button"
                                onClick={redo}
                                disabled={!canRedo || isLocked}
                                aria-label={t('whiteboard.redo')}
                                className={`${ISLAND_BTN} !h-8 !w-8`}
                            >
                                <Redo2 size={15} />
                            </button>
                        </Tooltip>
                    </div>
                )}
                </div>

                {/* Help (bottom-right) */}
                {!isReadOnly && (
                    <Tooltip text={`${t('whiteboard.shortcuts')} (?)`} side="left">
                        <button
                            type="button"
                            onClick={() => setShowShortcuts(true)}
                            aria-label={t('whiteboard.shortcuts')}
                            className={`absolute bottom-3 right-3 z-50 hidden sm:flex ${ISLAND} ${ISLAND_BTN}`}
                        >
                            <CircleHelp size={17} strokeWidth={1.75} />
                        </button>
                    </Tooltip>
                )}

                {/* Toolbar (visible while locked so it can be unlocked; tools are disabled) */}
                {!isReadOnly && (
                    <WhiteboardToolbar
                        currentTool={currentTool}
                        setCurrentTool={setCurrentTool}
                        isLocked={isLocked}
                        onToggleLock={() => setIsLocked(v => !v)}
                    />
                )}

                {/* Property panel, below the menu button */}
                {!isLocked && !isReadOnly && (
                    <div className="absolute left-0 top-12 bottom-0 pointer-events-none z-50 [&>*]:pointer-events-auto">
                        <WhiteboardToolProperties
                            currentTool={currentTool}
                            isPublic={isPublic}
                            defaults={{ color: currentColor, strokeWidth: currentStrokeWidth, fill: currentFill, roundness: currentRoundness }}
                            onDefaultsChange={handleDefaultsChange}
                            selectionCount={selectedObjectIds.length}
                            onDelete={handleDelete}
                            selectedShapeStyle={selectedShapeStyle}
                            onShapeStyleUpdate={handleShapeStyleUpdate}
                            onShapeTextUpdate={handleShapeTextUpdate}
                            selectedTextData={getSelectedTextData()}
                            onTextUpdate={handleTextPropertyUpdate}
                            selectedEdgeData={getSelectedEdgeData()}
                            onEdgeUpdate={handleEdgePropertyUpdate}
                        />
                    </div>
                )}

                {/* Empty state */}
                {canvasObjects.size === 0 && viewObjects.size === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-6" style={{ zIndex: 35 }}>
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-200/60 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                                <PenLine size={22} />
                            </div>
                            <div className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                                {t('whiteboard.emptyState')}
                            </div>
                            {!isReadOnly && (
                                <div className="max-w-xs text-xs text-muted-foreground">
                                    {t('whiteboard.emptyStateHint')}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <WhiteboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

            {!isReadOnly && workspaceId && viewId && (
                <AddElementDialog
                    workspaceId={workspaceId}
                    viewId={viewId}
                    isOpen={isAddingNote}
                    onOpenChange={(open) => {
                        setIsAddingNote(open);
                        // Closing the picker (added or cancelled) ends the note tool
                        if (!open) setCurrentTool('select');
                    }}
                    onElementAdded={handleElementAdded}
                />
            )}
        </>
    );
};

const menuItem = 'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-neutral-700 outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-neutral-100 dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-700';
const kbd = 'rounded border border-neutral-200 px-1 font-sans text-[10px] text-neutral-400 dark:border-neutral-600';

export default WhiteboardViewComponent;
