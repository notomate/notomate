import type { KeyboardEvent } from 'react';
import { requestFocus, selectBlocks, useEditor } from '../model/store';
import { rangeBetween } from '../model/tree';
import {
  backspaceAtStart,
  deleteAtEnd,
  duplicateBlocks,
  indentBlocks,
  neighborText,
  neighborVisible,
  outdentBlocks,
  splitBlock,
} from '../ops';
import { moveSelection } from '../selection/blockKeyboard';
import { filterCommands, applySlash } from '../commands';
import {
  caretRect,
  getSelectionOffsets,
  isCaretAtEnd,
  isCaretAtStart,
  isOnFirstLine,
  isOnLastLine,
} from '../inline/caret';
import { toggleMark, type Mark } from '../inline/marks';
import { contentOf, getSpec } from '../blocks/registry';
import { openLinkEditor } from '../components/FormatToolbar';
import { handleTriggerKey } from '../triggers';

const MARK_KEYS: Record<string, Mark> = { b: 'bold', i: 'italic', u: 'underline', e: 'code' };

function handleSlashKey(e: KeyboardEvent): boolean {
  const s = useEditor.getState().slash;
  if (!s) return false;
  const items = filterCommands(s.query);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!items.length) return true;
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    useEditor.setState({ slash: { ...s, index: (s.index + delta + items.length) % items.length } });
    return true;
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (!items.length) {
      useEditor.setState({ slash: null });
      return false;
    }
    e.preventDefault();
    applySlash(items[Math.min(s.index, items.length - 1)]);
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    useEditor.setState({ slash: null });
    return true;
  }
  return false;
}

/** Keyboard handling while the caret is inside a block's text. */
export function onTextKeyDown(e: KeyboardEvent<HTMLElement>, id: string) {
  const el = e.currentTarget;
  const native = e.nativeEvent;
  // Never interfere with IME composition (e.g. Zhuyin / Pinyin candidate selection).
  if (native.isComposing || native.keyCode === 229) return;
  if (handleTriggerKey(e) || handleSlashKey(e)) return;

  const st = useEditor.getState();
  const block = st.doc.blocks[id];
  if (!block) return;
  const mod = e.ctrlKey || e.metaKey;
  const isCode = contentOf(block.type) === 'plain';
  const offsets = () => getSelectionOffsets(el) ?? { start: 0, end: 0 };

  if (mod && !e.shiftKey && !e.altKey && MARK_KEYS[e.key.toLowerCase()]) {
    e.preventDefault();
    toggleMark(el, MARK_KEYS[e.key.toLowerCase()]);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  if (mod && e.shiftKey && (e.key.toLowerCase() === 's' || e.key.toLowerCase() === 'x')) {
    e.preventDefault();
    toggleMark(el, 'strike');
    return;
  }
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openLinkEditor();
    return;
  }
  if (mod && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    duplicateBlocks([id]);
    return;
  }
  if (mod && e.key.toLowerCase() === 'a') {
    const text = el.textContent ?? '';
    const sel = window.getSelection();
    if (!text || (sel && sel.toString().length >= text.length)) {
      // Second Ctrl+A selects every block on the page.
      e.preventDefault();
      el.blur();
      selectBlocks(st.doc.rootIds);
    }
    return;
  }
  if (mod && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    moveSelection([id], e.key === 'ArrowUp' ? -1 : 1, { focusId: id, at: offsets().start });
    return;
  }

  switch (e.key) {
    case 'Enter': {
      if (mod) {
        e.preventDefault();
        getSpec(block.type)?.onModEnter?.(block);
        return;
      }
      if (isCode && !e.shiftKey) {
        e.preventDefault();
        // insertText('\n') acts like insertParagraph in Chrome and wraps the line in a <div>;
        // insertLineBreak under white-space: pre inserts a literal newline.
        document.execCommand('insertLineBreak');
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        if (isCode) {
          splitBlock(id, offsets().start, offsets().end);
          return;
        }
        document.execCommand('insertLineBreak');
        return;
      }
      e.preventDefault();
      const o = offsets();
      splitBlock(id, o.start, o.end);
      return;
    }
    case 'Backspace': {
      if (isCaretAtStart(el)) {
        e.preventDefault();
        backspaceAtStart(id);
      }
      return;
    }
    case 'Delete': {
      if (isCaretAtEnd(el)) {
        e.preventDefault();
        deleteAtEnd(id);
      }
      return;
    }
    case 'Tab': {
      e.preventDefault();
      if (isCode) {
        if (!e.shiftKey) document.execCommand('insertText', false, '  ');
        return;
      }
      const at = offsets().start;
      if (e.shiftKey) outdentBlocks([id], { id, at });
      else indentBlocks([id], { id, at });
      return;
    }
    case 'Escape': {
      e.preventDefault();
      el.blur();
      selectBlocks([id]);
      return;
    }
    case 'ArrowUp':
    case 'ArrowDown': {
      if (mod || e.altKey) return;
      const up = e.key === 'ArrowUp';
      const edge = up ? isOnFirstLine(el) : isOnLastLine(el);
      if (!edge) return;
      if (e.shiftKey) {
        // Shift+↑ on the first line (or ↓ on the last) grows into block selection.
        const o = offsets();
        const len = el.textContent?.length ?? 0;
        if ((up && o.start === 0) || (!up && o.end === len)) {
          e.preventDefault();
          const other = neighborVisible(id, up ? -1 : 1);
          el.blur();
          const ids = other ? rangeBetween(st.doc, id, other) : [id];
          selectBlocks(ids, id, other ?? id);
        }
        return;
      }
      const target = neighborText(id, up ? -1 : 1);
      if (!target) return;
      e.preventDefault();
      const x = caretRect()?.left ?? el.getBoundingClientRect().left;
      requestFocus(target, { x, line: up ? 'last' : 'first' });
      return;
    }
    case 'ArrowLeft':
    case 'ArrowRight': {
      if (e.shiftKey || mod || e.altKey) return;
      const left = e.key === 'ArrowLeft';
      if (left ? !isCaretAtStart(el) : !isCaretAtEnd(el)) return;
      const target = neighborText(id, left ? -1 : 1);
      if (!target) return;
      e.preventDefault();
      requestFocus(target, left ? 'end' : 'start');
      return;
    }
  }
}
