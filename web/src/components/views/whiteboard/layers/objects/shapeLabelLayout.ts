import { CSSProperties } from 'react';
import { WhiteboardShapeData } from '../../../../../types/view';
import { Viewport } from '../../tools/types';
import { SHAPE_TEXT_LINE_HEIGHT, SHAPE_TEXT_PADDING, SHAPE_TEXT_SIZE, shapeTextBox } from '../../ui';

/**
 * Screen-space layout of a shape's label: `box` covers the shape's text area and
 * centres its child, `text` is the font. Shared by the label and its inline
 * editor so the text doesn't jump when editing starts or ends.
 */
export const shapeLabelLayout = (data: WhiteboardShapeData, viewport: Viewport): { box: CSSProperties; text: CSSProperties } | null => {
    const b = shapeTextBox(data);
    if (!b) return null;
    const { x: panX, y: panY, zoom } = viewport;
    return {
        box: {
            position: 'absolute',
            left: b.x * zoom + panX,
            top: b.y * zoom + panY,
            width: b.width * zoom,
            height: b.height * zoom,
            padding: SHAPE_TEXT_PADDING * zoom,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        },
        text: {
            maxWidth: '100%',
            fontFamily: data.fontFamily || 'sans-serif',
            fontSize: (data.fontSize || SHAPE_TEXT_SIZE) * zoom,
            fontWeight: data.fontWeight || 'normal',
            fontStyle: data.fontStyle || 'normal',
            textDecoration: data.textDecoration || 'none',
            color: data.color || '#000000',
            lineHeight: SHAPE_TEXT_LINE_HEIGHT,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
        },
    };
};
