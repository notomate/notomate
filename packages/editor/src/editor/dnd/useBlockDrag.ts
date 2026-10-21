import type { PointerEvent as ReactPointerEvent } from 'react';
import { create } from 'zustand';
import type { DropPosition } from '../model/types';
import { canHaveChildren } from '../model/types';
import { commit, selectBlocks, useEditor } from '../model/store';
import { depthOf, isAncestor, moveBlocks, rangeBetween, topLevel } from '../model/tree';
import { blockIdOfRow, createAutoScroller, isMouse, rowsIn } from '../input/pointer';
import { htmlToText } from '../inline/sanitize';

interface DragView {
  indicator: { top: number; left: number; width: number } | null;
  ghost: { x: number; y: number; label: string; count: number } | null;
}

export const useDragView = create<DragView>()(() => ({ indicator: null, ghost: null }));

const LONG_PRESS_MS = 300;
/** Horizontal distance for one nesting level (matches .block-children padding). */
const INDENT = 26;

interface Drop {
  targetId: string;
  pos: DropPosition;
  line: { top: number; left: number; width: number };
}

interface Candidate {
  targetId: string;
  pos: DropPosition;
  left: number;
}

function rowOf(id: string) {
  return document.querySelector<HTMLElement>(`[data-block-id="${id}"] > .block-row`);
}

/**
 * Notion-style drop resolution. The pointer's y picks the gap between two rows
 * (ignoring the rows being dragged); its x relative to where the drag began
 * picks the nesting depth among the depths that are valid in that gap:
 * anything from the depth of the row below up to one level deeper than the row above.
 */
function computeDrop(x: number, y: number, moving: string[]): Drop | null {
  const doc = useEditor.getState().doc;
  const rows = rowsIn(document.querySelector('.blocks') ?? document).filter((r) => {
    const id = blockIdOfRow(r);
    return !moving.includes(id) && !moving.some((m) => isAncestor(doc, m, id));
  });
  if (!rows.length) return null;
  const rects = rows.map((r) => r.getBoundingClientRect());
  let i = 0;
  while (i < rows.length && y > rects[i].top + rects[i].height / 2) i++;
  const above = i > 0 ? blockIdOfRow(rows[i - 1]) : null;
  const below = i < rows.length ? blockIdOfRow(rows[i]) : null;
  const top = above ? rects[i - 1].bottom : rects[0].top - 2;
  const right = Math.max(...rects.map((r) => r.right));

  if (!above) {
    return { targetId: below!, pos: 'before', line: { top, left: rects[0].left, width: right - rects[0].left } };
  }

  const candidates: Candidate[] = [];
  const minDepth = below ? depthOf(doc, below) : 0;
  const aboveBlock = doc.blocks[above];
  const aboveLeft = rects[i - 1].left;
  if (canHaveChildren(aboveBlock)) {
    const firstChild = aboveBlock.children.find((c) => !moving.includes(c));
    const childRow = firstChild ? rowOf(firstChild) : null;
    candidates.push({
      targetId: above,
      pos: 'inside',
      left: childRow ? childRow.getBoundingClientRect().left : aboveLeft + INDENT,
    });
  }
  // "after" the row above or any of its ancestors, as long as the row below stays valid.
  for (let id: string | null = above; id && depthOf(doc, id) >= minDepth; id = doc.blocks[id].parentId) {
    const r = rowOf(id);
    candidates.push({ targetId: id, pos: 'after', left: r ? r.getBoundingClientRect().left : aboveLeft });
  }
  if (!candidates.length) return null;

  let best = candidates[0];
  for (const c of candidates) if (Math.abs(c.left - x) < Math.abs(best.left - x)) best = c;
  return { targetId: best.targetId, pos: best.pos, line: { top, left: best.left, width: right - best.left } };
}

function showIndicator(drop: Drop | null) {
  useDragView.setState({ indicator: drop ? drop.line : null });
}

/**
 * Pointer handler for the ⋮⋮ handle.
 * Mouse: click opens the block menu, drag (>4px) moves blocks.
 * Touch/pen: tap opens the menu (tapping more handles adds to the selection),
 * long-press starts the drag. Touch never starts a marquee.
 */
export function onHandlePointerDown(e: ReactPointerEvent<HTMLElement>, id: string) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const handle = e.currentTarget;
  const mouse = isMouse(e);
  const pointerId = e.pointerId;
  handle.setPointerCapture(pointerId);
  const startX = e.clientX;
  const startY = e.clientY;
  // Depth follows horizontal movement: dragging one indent to the right nests one level.
  const startLeft = rowOf(id)?.getBoundingClientRect().left ?? startX;
  const contentX = (x: number) => startLeft + (x - startX);
  const shift = e.shiftKey;
  let dragging = false;
  let cancelled = false;
  let moving: string[] = [];
  let drop: Drop | null = null;
  let last = { x: startX, y: startY };
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scroller = createAutoScroller(() => {
    drop = computeDrop(contentX(last.x), last.y, moving);
    showIndicator(drop);
  });

  const beginDrag = () => {
    dragging = true;
    const st = useEditor.getState();
    const doc = st.doc;
    moving = st.selection.ids.includes(id) ? topLevel(doc, st.selection.ids) : [id];
    (document.activeElement as HTMLElement | null)?.blur?.();
    window.getSelection()?.removeAllRanges();
    selectBlocks(moving);
    useEditor.setState({ dragging: true, blockMenu: null });
    document.body.classList.add('ne-is-dragging');
    if (!mouse) navigator.vibrate?.(10);
    const label = htmlToText(doc.blocks[moving[0]].html).slice(0, 60) || doc.blocks[moving[0]].type;
    useDragView.setState({ ghost: { x: last.x, y: last.y, label, count: moving.length } });
  };

  if (!mouse) timer = setTimeout(() => !cancelled && beginDrag(), LONG_PRESS_MS);

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    last = { x: ev.clientX, y: ev.clientY };
    const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
    if (!dragging) {
      if (mouse && dist > 4) beginDrag();
      else if (!mouse && dist > 8) cancelled = true; // moved before long-press fired
      if (!dragging) return;
    }
    useDragView.setState({ ghost: { ...useDragView.getState().ghost!, x: ev.clientX, y: ev.clientY } });
    drop = computeDrop(contentX(ev.clientX), ev.clientY, moving);
    showIndicator(drop);
    scroller.update(ev.clientY);
  };

  const finish = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    clearTimeout(timer);
    scroller.stop();
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', finish);
    handle.removeEventListener('pointercancel', finish);
    if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    useDragView.setState({ indicator: null, ghost: null });
    document.body.classList.remove('ne-is-dragging');

    if (dragging) {
      useEditor.setState({ dragging: false });
      if (drop && ev.type === 'pointerup') {
        const d = drop;
        commit((doc) => moveBlocks(doc, moving, d.targetId, d.pos), { select: moving });
      }
      return;
    }
    if (ev.type !== 'pointerup' || cancelled) return;
    openMenuFor(id, handle, { additive: !mouse || shift, range: mouse && shift });
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
}

function openMenuFor(id: string, handle: HTMLElement, opts: { additive: boolean; range: boolean }) {
  const st = useEditor.getState();
  const current = st.selection.ids;
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (opts.range && st.selection.anchor) {
    selectBlocks(rangeBetween(st.doc, st.selection.anchor, id), st.selection.anchor, id);
  } else if (opts.additive && current.length && !current.includes(id)) {
    selectBlocks([...current, id]);
  } else if (!current.includes(id)) {
    selectBlocks([id]);
  }
  const r = handle.getBoundingClientRect();
  useEditor.setState({ blockMenu: { x: r.left, y: r.bottom + 4 } });
}
