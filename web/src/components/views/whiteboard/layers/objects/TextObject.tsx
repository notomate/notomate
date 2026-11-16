import React from 'react';
import { WhiteboardTextData } from '../../../../../types/view';
import { Viewport } from '../../tools/types';
import { INK } from '../../ui';

interface TextObjectProps {
    data: WhiteboardTextData;
    viewport: Viewport;
}

const TextObject: React.FC<TextObjectProps> = ({ data, viewport }) => {
    if (!data?.position) return null;

    const { x: panX, y: panY, zoom } = viewport;
    const fontSize = data.fontSize || 16;
    const displayText = data.text?.trim() || 'Text';
    const isPlaceholder = !data.text?.trim();

    // Screen position: canvas text is drawn from baseline, so shift up by fontSize
    const screenLeft = data.position.x * zoom + panX;
    const screenTop = (data.position.y - fontSize) * zoom + panY;

    return (
        <div
            className={isPlaceholder ? undefined : INK}
            style={{
                position: 'absolute',
                left: screenLeft,
                top: screenTop,
                fontFamily: data.fontFamily || 'sans-serif',
                fontSize: fontSize * zoom,
                fontWeight: data.fontWeight || 'normal',
                fontStyle: data.fontStyle || 'normal',
                textDecoration: data.textDecoration || 'none',
                color: isPlaceholder ? '#9ca3af' : (data.color || '#000000'),
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                lineHeight: 1,
            }}
        >
            {displayText}
        </div>
    );
};

export default TextObject;
