import type { KeyboardEvent, ClipboardEvent } from 'react';
import { clearSelection, commit, requestFocus, selectBlocks, useEditor } from '../model/store';
import { isAncestor, moveBlocks, rangeBetween, siblingsOf, topLevel, visibleOrder } from '../model/tree';
import { isTextBlock } from '../model/types';
import {
  deleteBlocks,
  duplicateBlocks,
  fragmentOf,
  indentBlocks,
  insertFragment,
  outdentBlocks,
} from '../ops';
import { fragmentFromText, readFragment, writeFragment } from '../clipboard';
import { runTransfer } from '../plugins';

const state = () => useEditor.getState();

/** Next/previous visible block; moving down skips the subtree of `id`. */
function step(id: string, dir: -1 | 1): string | null {
  const doc = state().doc;
  const order = visibleOrder(doc);
  let i = order.indexOf(id);
  if (dir > 0) {
    do i++;
    while (i < order.length && isAncestor(doc, id, order[i]));
  } else {
    i--;
  }
  return order[i] ?? null;
}

/** Move blocks one sibling slot up or down (Ctrl+Shift+↑/↓). */
export function moveSelection(ids: string[], dir: -1 | 1, keepFocus?: { focusId: string; at: number }) {
  const doc = state().doc;
  const top = topLevel(doc, ids);
  if (!top.length) return;
  const edge = dir < 0 ? top[0] : top[top.length - 1];
  const sibs = siblingsOf(doc, edge);
  const target = sibs[sibs.indexOf(edge) + dir];
  if (!target) return;
  commit((d) => moveBlocks(d, top, target, dir < 0 ? 'before' : 'after'), keepFocus
    ? { focus: { id: keepFocus.focusId, at: keepFocus.at } }
    : { select: top });
}

export function onSinkKeyDown(e: KeyboardEvent) {
  const { selection, blockMenu, doc } = state();
  const ids = selection.ids;
  const mod = e.ctrlKey || e.metaKey;
  if (blockMenu) {
    if (e.key === 'Escape') {
      e.preventDefault();
      useEditor.setState({ blockMenu: null });
    }
    return;
  }
  if (!ids.length) return;

  if (mod) {
    const k = e.key.toLowerCase();
    if (k === 'd') {
      e.preventDefault();
      duplicateBlocks(ids);
    } else if (k === 'a') {
      e.preventDefault();
      selectBlocks(doc.rootIds);
    } else if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moveSelection(ids, e.key === 'ArrowUp' ? -1 : 1);
    }
    return;
  }

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      clearSelection();
      return;
    case 'Backspace':
    case 'Delete':
      e.preventDefault();
      deleteBlocks(ids);
      return;
    case 'Enter': {
      e.preventDefault();
      const first = topLevel(doc, ids)[0];
      if (first && isTextBlock(doc.blocks[first])) requestFocus(first, 'end');
      return;
    }
    case 'Tab':
      e.preventDefault();
      if (e.shiftKey ? outdentBlocks(ids) : indentBlocks(ids)) selectBlocks(ids);
      return;
    case 'ArrowUp':
    case 'ArrowDown': {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? -1 : 1;
      if (e.shiftKey) {
        const anchor = selection.anchor ?? ids[0];
        const focus = step(selection.focus ?? ids[ids.length - 1], dir);
        if (!focus) return;
        selectBlocks(rangeBetween(state().doc, anchor, focus), anchor, focus);
      } else {
        const top = topLevel(doc, ids);
        const from = dir < 0 ? top[0] : top[top.length - 1];
        const next = step(from, dir) ?? from;
        selectBlocks([next]);
      }
      return;
    }
    default:
      // Typing a character drops the block selection, like Notion.
      if (e.key.length === 1 && !e.altKey) clearSelection();
  }
}

export function onSinkCopy(e: ClipboardEvent, cut = false) {
  const ids = state().selection.ids;
  if (!ids.length) return;
  e.preventDefault();
  writeFragment(e.clipboardData, fragmentOf(ids));
  if (cut) deleteBlocks(ids);
}

export function onSinkPaste(e: ClipboardEvent) {
  const ids = topLevel(state().doc, state().selection.ids);
  if (!ids.length) return;
  e.preventDefault();
  const own = readFragment(e.clipboardData);
  if (!own && runTransfer('onPaste', e.clipboardData, { blockId: ids[ids.length - 1], plain: false })) return;
  const frag = own ?? fragmentFromText(e.clipboardData.getData('text/plain'));
  if (frag.rootIds.length) insertFragment(ids[ids.length - 1], frag, { select: true });
}
