import React, { CSSProperties, useEffect, useRef } from 'react';
import { WhiteboardShapeData, WhiteboardTextData } from '../../../types/view';
import { Viewport } from './tools/types';
import { INK } from './ui';
import { shapeLabelLayout } from './layers/objects/shapeLabelLayout';

type InlineTextEditorProps = {
    viewport: Viewport;
    /** Called once, with the final text, when editing ends (blur, Escape, Enter for text objects). */
    onCommit: (text: string) => void;
} & (
    | { kind: 'shape'; data: WhiteboardShapeData }
    | { kind: 'text'; data: WhiteboardTextData }
);

/**
 * Edits a shape label or a text object in place, laid out exactly like the
 * rendered text. Shape labels are multi-line (Enter adds a line, Ctrl/⌘+Enter
 * or Escape finishes); text objects are single-line (Enter finishes).
 */
const InlineTextEditor: React.FC<InlineTextEditorProps> = (props) => {
    const { viewport, onCommit, kind, data } = props;
    const ref = useRef<HTMLDivElement>(null);
    const done = useRef(false);

    // Seed the content once and select it all, so typing replaces it
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.innerText = data.text ?? '';
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        // Only on mount: later remote updates must not reset what is being typed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finish = () => {
        if (done.current) return;
        done.current = true;
        const raw = ref.current?.innerText ?? '';
        onCommit(kind === 'text' ? raw.replace(/\n/g, ' ') : raw.replace(/\n+$/, ''));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (kind === 'text' ? !e.shiftKey : e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            ref.current?.blur();
        }
    };

    const editable = (style: CSSProperties) => (
        <div
            ref={ref}
            className={INK}
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={finish}
            onKeyDown={handleKeyDown}
            // Keep pointer gestures inside the editor from reaching the canvas
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            style={{ ...style, outline: 'none', cursor: 'text', minWidth: '1ch' }}
        />
    );

    if (kind === 'shape') {
        const layout = shapeLabelLayout(data, viewport);
        if (!layout) return null;
        return (
            <div style={{ ...layout.box, zIndex: 45, pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto', maxWidth: '100%' }}>{editable(layout.text)}</div>
            </div>
        );
    }

    const { x: panX, y: panY, zoom } = viewport;
    const fontSize = data.fontSize || 16;
    return (
        <div
            style={{
                position: 'absolute',
                left: data.position.x * zoom + panX,
                top: (data.position.y - fontSize) * zoom + panY,
                zIndex: 45,
            }}
        >
            {editable({
                fontFamily: data.fontFamily || 'sans-serif',
                fontSize: fontSize * zoom,
                fontWeight: data.fontWeight || 'normal',
                fontStyle: data.fontStyle || 'normal',
                textDecoration: data.textDecoration || 'none',
                color: data.color || '#000000',
                whiteSpace: 'pre',
                lineHeight: 1,
            })}
        </div>
    );
};

export default InlineTextEditor;
