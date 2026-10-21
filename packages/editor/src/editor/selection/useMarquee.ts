import { useEffect, type RefObject } from 'react';
import { clearSelection, requestFocus, selectBlocks, useEditor } from '../model/store';
import { isTextBlock } from '../model/types';
import { insertBlockAfter } from '../ops';
import { blockIdOfRow, createAutoScroller, isMouse, rowsIn } from '../input/pointer';
import { caretFromPoint } from '../inline/caret';

/** Elements that must keep their own pointer behaviour. */
const NO_MARQUEE = '[contenteditable="true"], button, input, textarea, select, a, .handle, .ui-layer, .no-marquee';

function placeCaret(id: string, x: number, y: number) {
  const el = document.querySelector<HTMLElement>(`[data-editable-id="${id}"]`);
  if (!el) return;
  const box = el.getBoundingClientRect();
  const cx = Math.min(Math.max(x, box.left + 1), box.right - 1);
  const cy = Math.min(Math.max(y, box.top + 1), box.bottom - 1);
  el.focus({ preventScroll: true });
  const p = caretFromPoint(cx, cy);
  if (p && el.contains(p.node)) window.getSelection()?.setBaseAndExtent(p.node, p.offset, p.node, p.offset);
  else requestFocus(id, x < box.left + box.width / 2 ? 'start' : 'end');
}

/** A plain click outside text: put the caret in the row at that height, or extend the page. */
function clickAt(root: HTMLElement, x: number, y: number) {
  const rows = rowsIn(root);
  const hit = rows.find((r) => {
    const b = r.getBoundingClientRect();
    return y >= b.top && y < b.bottom;
  });
  const doc = useEditor.getState().doc;
  if (hit) {
    const id = blockIdOfRow(hit);
    if (isTextBlock(doc.blocks[id])) {
      placeCaret(id, x, y);
    } else {
      (document.activeElement as HTMLElement | null)?.blur?.();
      selectBlocks([id]);
    }
    return;
  }
  const last = rows[rows.length - 1];
  if (last && y > last.getBoundingClientRect().bottom) {
    const lastRoot = doc.rootIds[doc.rootIds.length - 1];
    const b = doc.blocks[lastRoot];
    if (b && b.type === 'paragraph' && !b.html && !b.children.length) requestFocus(lastRoot, 'start');
    else insertBlockAfter(lastRoot ?? null);
    return;
  }
  (document.activeElement as HTMLElement | null)?.blur?.();
  clearSelection();
}

/**
 * Rubber-band block selection. Mouse only: touch and pen never start a marquee,
 * so dragging on a phone scrolls the page as usual.
 */
export function useMarquee(rootRef: RefObject<HTMLElement | null>, boxRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let start: { x: number; y: number } | null = null;
    let client = { x: 0, y: 0 };
    let base: string[] = [];
    let active = false;
    let lastKey = '';

    const update = () => {
      if (!start || !boxRef.current) return;
      const cx = client.x + window.scrollX;
      const cy = client.y + window.scrollY;
      const left = Math.min(start.x, cx);
      const top = Math.min(start.y, cy);
      const right = Math.max(start.x, cx);
      const bottom = Math.max(start.y, cy);
      const box = boxRef.current;
      box.style.display = 'block';
      box.style.transform = `translate(${left - window.scrollX}px, ${top - window.scrollY}px)`;
      box.style.width = `${right - left}px`;
      box.style.height = `${bottom - top}px`;
      // Rows count as spanning the full page width, so dragging straight down
      // the side margin selects the blocks beside it, like Notion.
      const hits: string[] = [];
      for (const row of rowsIn(root)) {
        const r = row.getBoundingClientRect();
        const rt = r.top + window.scrollY;
        if (rt < bottom && rt + r.height > top) hits.push(blockIdOfRow(row));
      }
      const ids = [...new Set([...base, ...hits])];
      const key = ids.join(',');
      if (key !== lastKey) {
        lastKey = key;
        if (ids.length) selectBlocks(ids);
        else clearSelection();
      }
    };
    const scroller = createAutoScroller(update);

    const onMove = (e: PointerEvent) => {
      if (!start) return;
      client = { x: e.clientX, y: e.clientY };
      if (!active) {
        const dx = e.clientX + window.scrollX - start.x;
        const dy = e.clientY + window.scrollY - start.y;
        if (Math.hypot(dx, dy) < 4) return;
        active = true;
        document.body.classList.add('ne-is-selecting');
        window.getSelection()?.removeAllRanges();
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
      update();
      scroller.update(e.clientY);
    };

    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      scroller.stop();
      if (!start) return;
      if (!active && e.type === 'pointerup') clickAt(root, e.clientX, e.clientY);
      start = null;
      active = false;
      document.body.classList.remove('ne-is-selecting');
      if (boxRef.current) boxRef.current.style.display = 'none';
    };

    const onDown = (e: PointerEvent) => {
      if (!isMouse(e) || e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(NO_MARQUEE)) return;
      e.preventDefault();
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      base = additive ? useEditor.getState().selection.ids : [];
      lastKey = base.join(',');
      start = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY };
      client = { x: e.clientX, y: e.clientY };
      useEditor.setState({ blockMenu: null, slash: null });
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };

    root.addEventListener('pointerdown', onDown);
    return () => {
      root.removeEventListener('pointerdown', onDown);
      onUp(new PointerEvent('pointercancel'));
    };
  }, [rootRef, boxRef]);
}
