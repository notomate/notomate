import { WhiteboardStrokeData, WhiteboardShapeData, WhiteboardTextData, WhiteboardEdgeData, WhiteboardNoteData, ViewObjectType } from '../../../../types/view';

export type Tool = 'hand' | 'select' | 'marquee' | 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'note' | 'edge';

/** Letter shortcuts for each tool (handled in WhiteboardViewComponent). */
export const TOOL_SHORTCUTS: Partial<Record<Tool, string>> = {
    hand: 'H',
    select: 'V',
    rectangle: 'R',
    circle: 'O',
    edge: 'A',
    line: 'L',
    pen: 'P',
    text: 'T',
    note: 'N',
    eraser: 'E',
};

/** Number-row shortcuts, shown as the small badge on each toolbar button. */
export const TOOL_NUMBERS: Partial<Record<Tool, string>> = {
    select: '1',
    rectangle: '2',
    circle: '3',
    edge: '4',
    line: '5',
    pen: '6',
    text: '7',
    note: '8',
    eraser: '9',
};

export interface CanvasObject {
    id: string;
    type: 'stroke' | 'shape';
    data: WhiteboardStrokeData | WhiteboardShapeData;
}

export interface WhiteboardObject {
    id: string;
    type: ViewObjectType;
    name: string;
    data: WhiteboardTextData | WhiteboardEdgeData | WhiteboardNoteData | any;
}

export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Bounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type ResizeHandle = 'se' | 'sw' | 'ne' | 'nw';
export type ConnectionPoint = 'top' | 'bottom' | 'left' | 'right';

export interface ToolContext {
    canvasRef: React.RefObject<HTMLCanvasElement>;
    viewport: Viewport;
    setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
    canvasObjects: Map<string, CanvasObject>;
    setCanvasObjects: React.Dispatch<React.SetStateAction<Map<string, CanvasObject>>>;
    viewObjects: Map<string, WhiteboardObject>;
    setViewObjects: React.Dispatch<React.SetStateAction<Map<string, WhiteboardObject>>>;
    currentColor: string;
    currentStrokeWidth: number;
    selectedObjectId: string | null;
    setSelectedObjectId: React.Dispatch<React.SetStateAction<string | null>>;
    sendUpdate: (update: any) => void;
    screenToCanvas: (screenX: number, screenY: number) => Point;
    render: () => void;
}

export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
