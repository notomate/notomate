import { useEffect } from 'react';
import { clearSelection, selectBlocks, useEditor } from '../model/store';
import { rangeBetween } from '../model/tree';
import { blockIdOfRow, createAutoScroller, isMouse, rowAtY } from '../input/pointer';
import { caretFromPoint } from '../inline/caret';

/**
 * Notion detail: dragging a text selection out of one block into another turns it
 * into a block selection; dragging back into the origin block restores the text
 * selection. Mouse only — touch keeps the platform's native selection handles.
 */
export function useTextToBlockDrag() {
  useEffect(() => {
    let origin: HTMLElement | null = null;
    let originId = '';
    let anchor: { node: Node; offset: number } | null = null;
    let blockMode = false;
    let lastY = 0;

    const sync = () => {
      if (!origin) return;
      const row = rowAtY(lastY);
      const hovered = row ? blockIdOfRow(row) : null;
      if (!blockMode) {
        if (!anchor) {
          const sel = window.getSelection();
          if (sel?.anchorNode && origin.contains(sel.anchorNode)) anchor = { node: sel.anchorNode, offset: sel.anchorOffset };
        }
        if (hovered && hovered !== originId) {
          blockMode = true;
          document.body.classList.add('ne-is-selecting');
          window.getSelection()?.removeAllRanges();
          origin.blur();
        }
      }
      if (blockMode && hovered) {
        if (hovered === originId) return;
        selectBlocks(rangeBetween(useEditor.getState().doc, originId, hovered), originId, hovered);
      }
    };
    const scroller = createAutoScroller(sync);

    const onMove = (e: PointerEvent) => {
      if (!origin || !(e.buttons & 1)) return;
      lastY = e.clientY;
      const row = rowAtY(e.clientY);
      const hovered = row ? blockIdOfRow(row) : null;
      if (blockMode && hovered === originId) {
        // Back in the origin block: restore a text selection from the original anchor.
        blockMode = false;
        document.body.classList.remove('ne-is-selecting');
        clearSelection();
        origin.focus({ preventScroll: true });
        const p = caretFromPoint(e.clientX, e.clientY);
        if (anchor && p && origin.contains(p.node)) {
          window.getSelection()?.setBaseAndExtent(anchor.node, anchor.offset, p.node, p.offset);
        }
        return;
      }
      if (blockMode) window.getSelection()?.removeAllRanges();
      sync();
      scroller.update(e.clientY);
    };

    const onUp = () => {
      origin = null;
      anchor = null;
      blockMode = false;
      scroller.stop();
      document.body.classList.remove('ne-is-selecting');
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    const onDown = (e: PointerEvent) => {
      if (!isMouse(e) || e.button !== 0 || e.shiftKey) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-editable-id]');
      if (!el) return;
      origin = el;
      originId = el.dataset.editableId!;
      anchor = null;
      blockMode = false;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      onUp();
    };
  }, []);
}
