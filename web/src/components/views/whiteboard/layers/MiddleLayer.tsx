import React from 'react';
import { CanvasObject, WhiteboardObject, Viewport } from '../tools/types';
import { WhiteboardStrokeData, WhiteboardShapeData, WhiteboardTextData, WhiteboardNoteData } from '../../../../types/view';
import StrokeCanvas from './objects/StrokeCanvas';
import ShapeCanvas from './objects/ShapeCanvas';
import TextObject from './objects/TextObject';
import ShapeLabel from './objects/ShapeLabel';
import NoteOverlay from '../NoteOverlay';

interface MiddleLayerProps {
    canvasObjects: Map<string, CanvasObject>;
    viewObjects: Map<string, WhiteboardObject>;
    viewport: Viewport;
    workspaceId?: string;
    viewId?: string;
    isPublic?: boolean;
    selectedObjectIds: string[];
    onNoteHeightChange: (viewObjectId: string, height: number) => void;
    /** Object whose text is open in the inline editor (its own rendering is hidden). */
    editingId?: string | null;
}

const MiddleLayer: React.FC<MiddleLayerProps> = ({
    canvasObjects,
    viewObjects,
    viewport,
    workspaceId,
    viewId,
    selectedObjectIds,
    onNoteHeightChange,
    editingId,
}) => {
    return (
        // Plain container — each child computes its own screen position
        <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 20 }}
        >
            {/* Strokes */}
            {Array.from(canvasObjects.entries()).map(([id, obj]) => {
                if (obj.type === 'stroke') {
                    return <StrokeCanvas key={id} data={obj.data as WhiteboardStrokeData} viewport={viewport} />;
                }
                if (obj.type === 'shape') {
                    const data = obj.data as WhiteboardShapeData;
                    return (
                        <React.Fragment key={id}>
                            <ShapeCanvas data={data} viewport={viewport} />
                            {id !== editingId && <ShapeLabel data={data} viewport={viewport} />}
                        </React.Fragment>
                    );
                }
                return null;
            })}

            {/* Text and notes */}
            {Array.from(viewObjects.entries()).map(([id, obj]) => {
                if (obj.type === 'whiteboard_text') {
                    if (id === editingId) return null;
                    return <TextObject key={id} data={obj.data as WhiteboardTextData} viewport={viewport} />;
                }
                if (obj.type === 'whiteboard_note') {
                    const noteData: WhiteboardNoteData = typeof obj.data === 'string'
                        ? JSON.parse(obj.data)
                        : obj.data;
                    if (!noteData?.position) return null;
                    return (
                        <NoteOverlay
                            key={id}
                            viewObjectId={id}
                            position={noteData.position}
                            width={noteData.width || 768}
                            viewport={viewport}
                            workspaceId={workspaceId}
                            viewId={viewId!}
                            isSelected={selectedObjectIds.includes(id)}
                            onHeightChange={onNoteHeightChange}
                        />
                    );
                }
                return null;
            })}
        </div>
    );
};

export default MiddleLayer;
