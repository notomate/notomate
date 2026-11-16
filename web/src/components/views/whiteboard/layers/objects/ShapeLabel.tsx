import React from 'react';
import { WhiteboardShapeData } from '../../../../../types/view';
import { Viewport } from '../../tools/types';
import { INK } from '../../ui';
import { shapeLabelLayout } from './shapeLabelLayout';

interface ShapeLabelProps {
    data: WhiteboardShapeData;
    viewport: Viewport;
}

/** Text centred inside a rectangle or circle. */
const ShapeLabel: React.FC<ShapeLabelProps> = ({ data, viewport }) => {
    if (!data.text?.trim()) return null;
    const layout = shapeLabelLayout(data, viewport);
    if (!layout) return null;
    return (
        <div style={{ ...layout.box, pointerEvents: 'none' }}>
            <div className={INK} style={layout.text}>{data.text}</div>
        </div>
    );
};

export default ShapeLabel;
