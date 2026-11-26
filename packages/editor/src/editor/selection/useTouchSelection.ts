import { useEffect } from 'react';
import { useEditor } from '../model/store';

/** How long after a touch starts a selection counts as made by that touch (long-press, double-tap). */
const TOUCH_WINDOW_MS = 1500;
/** Just under Chrome Android's long-press delay (500ms). */
const LONG_PRESS_MS = 400;
const ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/**
 * Touch: native selection handles cannot leave the editing host they start in, so a
 * selection made by long-pressing the block being edited would stay on that line. When
 * a touch selects text there, stop editing that block (keeping the selection) so the
 * handles can be dragged across blocks like in the rest of the page.
 */
export function useTouchSelection() {
  useEffect(() => {
    let lastTouch = -Infinity;
    const onTouch = () => {
      lastTouch = performance.now();
    };
    const onChange = () => {
      if (!useEditor.getState().touchText || performance.now() - lastTouch > TOUCH_WINDOW_MS) return;
      const sel = window.getSelection();
      if (!sel?.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const host = (range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement)
        ?.closest<HTMLElement>('[data-editable-id]');
      if (!host?.isContentEditable || !host.contains(range.endContainer)) return;
      // Only once per touch; the handles keep firing selectionchange while dragged.
      lastTouch = -Infinity;
      const saved = range.cloneRange();
      host.contentEditable = 'false';
      host.blur();
      sel.removeAllRanges();
      sel.addRange(saved);
    };
    // Android: a long-press selection made inside an editing host stays bound to it for
    // the rest of that drag, even once the block is plain text. So when a finger rests
    // on the block being edited, stop editing it just before Chrome's long-press fires;
    // the selection then starts in plain text, like on the other blocks. (iOS uses
    // long-press in editable text to move the caret, so it keeps the fallback above.)
    let timer = 0;
    let start = { x: 0, y: 0 };
    const cancel = () => {
      clearTimeout(timer);
      timer = 0;
    };
    const onStart = (e: TouchEvent) => {
      onTouch();
      cancel();
      if (!ANDROID || e.touches.length !== 1 || !useEditor.getState().touchText) return;
      const host = (e.target as Element).closest?.<HTMLElement>('[data-editable-id]');
      if (!host?.isContentEditable || document.activeElement !== host) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      timer = window.setTimeout(() => {
        timer = 0;
        host.contentEditable = 'false';
        host.blur();
      }, LONG_PRESS_MS);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (timer && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) cancel();
    };
    const opts = { capture: true, passive: true } as const;
    document.addEventListener('touchstart', onStart, opts);
    document.addEventListener('touchmove', onMove, opts);
    document.addEventListener('touchend', cancel, opts);
    document.addEventListener('touchcancel', cancel, opts);
    document.addEventListener('selectionchange', onChange);
    return () => {
      cancel();
      document.removeEventListener('touchstart', onStart, opts);
      document.removeEventListener('touchmove', onMove, opts);
      document.removeEventListener('touchend', cancel, opts);
      document.removeEventListener('touchcancel', cancel, opts);
      document.removeEventListener('selectionchange', onChange);
    };
  }, []);
}
