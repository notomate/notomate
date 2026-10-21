import type { KeyboardEvent, ReactNode } from 'react';
import { create } from 'zustand';
import { commit, useEditor } from './model/store';
import { w } from './model/tree';
import { deleteTextRange, splitHtmlAt, textLength } from './inline/splitHtml';

/** A suggestion list opened by typing a character at the start of a word, e.g. `@` for mentions. */
export interface InlineTrigger {
  char: string;
  /** Suggestions for the text typed after `char`. Keep it fast; it runs on every keystroke. */
  items: (query: string) => InlineTriggerItem[];
  /** Heading above the list. */
  label?: string;
}

export interface InlineTriggerItem {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  /** Inline HTML that replaces the typed `char` + query, e.g. a mention span. */
  html: string;
}

export interface TriggerState {
  char: string;
  blockId: string;
  /** Text offset of the trigger character. */
  from: number;
  query: string;
  index: number;
}

let triggers: readonly InlineTrigger[] = [];

export function setTriggers(list: readonly InlineTrigger[]) {
  triggers = list;
}

export const useTrigger = create<{ active: TriggerState | null }>()(() => ({ active: null }));

export const closeTrigger = () => useTrigger.getState().active && useTrigger.setState({ active: null });

export function triggerFor(char: string) {
  return triggers.find((t) => t.char === char);
}

export function triggerItems(s: TriggerState): InlineTriggerItem[] {
  return triggerFor(s.char)?.items(s.query) ?? [];
}

/** Track the trigger while typing; called after the block's text is stored. */
export function updateTrigger(blockId: string, data: string | null, text: string, caret: number) {
  const s = useTrigger.getState().active;
  if (data && triggerFor(data)) {
    const before = text[caret - 2];
    if (caret === 1 || before === undefined || /\s/.test(before)) {
      useTrigger.setState({ active: { char: data, blockId, from: caret - 1, query: '', index: 0 } });
      return;
    }
  }
  if (!s || s.blockId !== blockId) return;
  if (caret <= s.from || text[s.from] !== s.char) {
    closeTrigger();
    return;
  }
  const query = text.slice(s.from + 1, caret);
  // A space after no match, or two spaces, ends the lookup.
  const done = /\s\s/.test(query) || (/\s$/.test(query) && !triggerItems({ ...s, query }).length);
  useTrigger.setState({ active: done ? null : { ...s, query, index: 0 } });
}

export function applyTrigger(item: InlineTriggerItem) {
  const s = useTrigger.getState().active;
  if (!s) return;
  const b = useEditor.getState().doc.blocks[s.blockId];
  closeTrigger();
  if (!b) return;
  const rest = deleteTextRange(b.html, s.from, s.from + 1 + s.query.length);
  const [before, after] = splitHtmlAt(rest, s.from);
  // A trailing space so typing continues outside the inserted chip.
  const inserted = `${item.html}&nbsp;`;
  commit((d) => {
    w(d, s.blockId).html = before + inserted + after;
  }, { focus: { id: s.blockId, at: s.from + textLength(inserted) } });
}

/** Arrow / Enter / Escape while the list is open. Returns true when the key was handled. */
export function handleTriggerKey(e: KeyboardEvent): boolean {
  const s = useTrigger.getState().active;
  if (!s) return false;
  const items = triggerItems(s);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (items.length) {
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      useTrigger.setState({ active: { ...s, index: (s.index + delta + items.length) % items.length } });
    }
    return true;
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (!items.length) {
      closeTrigger();
      return false;
    }
    e.preventDefault();
    applyTrigger(items[Math.min(s.index, items.length - 1)]);
    return true;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    closeTrigger();
    return true;
  }
  return false;
}
