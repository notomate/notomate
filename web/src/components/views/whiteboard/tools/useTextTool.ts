import { useCallback } from 'react';
import { WhiteboardTextData } from '../../../../types/view';
import { WhiteboardObject, Point, generateId } from './types';

interface UseTextToolOptions {
    currentColor: string;
    setViewObjects: React.Dispatch<React.SetStateAction<Map<string, WhiteboardObject>>>;
    setSelectedObjectId: (id: string | null) => void;
    sendUpdate: (update: any) => void;
}

interface UseTextToolReturn {
    /** Creates an empty text object at `pos` and returns its id. */
    createText: (pos: Point) => string;
    updateText: (objectId: string, updates: Partial<WhiteboardTextData>, viewObjects: Map<string, WhiteboardObject>) => void;
}

export const useTextTool = ({
    currentColor,
    setViewObjects,
    setSelectedObjectId,
    sendUpdate
}: UseTextToolOptions): UseTextToolReturn => {
    const createText = useCallback((pos: Point) => {
        const textData: WhiteboardTextData = {
            position: pos,
            text: '',
            color: currentColor,
            fontSize: 24,
            fontFamily: 'sans-serif',
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none'
        };
        const id = generateId();
        const newObject: WhiteboardObject = {
            id,
            type: 'whiteboard_text',
            name: 'Text',
            data: textData
        };

        setViewObjects(prev => new Map(prev).set(id, newObject));
        sendUpdate({ type: 'add_view_object', object: newObject });
        setSelectedObjectId(id);
        return id;
    }, [currentColor, setViewObjects, sendUpdate, setSelectedObjectId]);

    const updateText = useCallback((
        objectId: string,
        updates: Partial<WhiteboardTextData>,
        viewObjects: Map<string, WhiteboardObject>
    ) => {
        const viewObj = viewObjects.get(objectId);
        if (!viewObj || viewObj.type !== 'whiteboard_text') return;

        const updatedObj = {
            ...viewObj,
            data: {
                ...viewObj.data,
                ...updates
            }
        };

        setViewObjects(prev => new Map(prev).set(objectId, updatedObj));
        sendUpdate({ type: 'update_view_object', object: updatedObj });
    }, [setViewObjects, sendUpdate]);

    return {
        createText,
        updateText
    };
};
