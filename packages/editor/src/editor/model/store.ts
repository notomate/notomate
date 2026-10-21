import { create } from 'zustand';
import type { Block, Doc } from './types';
import { diffDocs, emit, type ChangeOrigin, type PresenceState } from '../events';
import { draft, emptyDoc, topLevel, w } from './tree';
import { getSelectionOffsets } from '../inline/caret';
import { repairOrphans } from './repair';

export type FocusAt = 'start' | 'end' | number | { x: number; line: 'first' | 'last' } | { start: number; end: number };

export interface FocusRequest {
  id: string;
  at: FocusAt;
  n: number;
}

export interface BlockSelection {
  ids: string[];
  anchor: string | null;
  focus: string | null;
}

interface Snapshot {
  doc: Doc;
  focus: { id: string; offset: number } | null;
}

export interface SlashState {
  blockId: string;
  /** Text offset of the "/" character. */
  from: number;
  query: string;
  index: number;
}

export interface MenuState {
  x: number;
  y: number;
}

export interface EditorState {
  doc: Doc;
  selection: BlockSelection;
  focusReq: FocusRequest | null;
  /** Block whose text currently has DOM focus. */
  focusedId: string | null;
  slash: SlashState | null;
  blockMenu: MenuState | null;
  dragging: boolean;
  past: Snapshot[];
  future: Snapshot[];
}

const EMPTY_SEL: BlockSelection = { ids: [], anchor: null, focus: null };

export const useEditor = create<EditorState>()(() => ({
  doc: emptyDoc(),
  selection: EMPTY_SEL,
  focusReq: null,
  focusedId: null,
  slash: null,
  blockMenu: null,
  dragging: false,
  past: [],
  future: [],
}));

const get = useEditor.getState;
const set = useEditor.setState;

let focusCounter = 0;
let lastKey: string | null = null;
let lastTime = 0;

function currentCaret(): Snapshot['focus'] {
  const el = (document.activeElement as HTMLElement | null)?.closest?.('[data-editable-id]') as HTMLElement | null;
  if (!el) return null;
  return { id: el.dataset.editableId!, offset: getSelectionOffsets(el)?.start ?? 0 };
}

export interface CommitOptions {
  /** Consecutive commits with the same key inside 1s merge into one undo step. */
  key?: string;
  focus?: { id: string; at: FocusAt };
  select?: string[] | null;
}

/** Apply a mutation to a copy-on-write draft of the document and record history. */
export function commit(mutator: (d: Doc) => void | boolean, opts: CommitOptions = {}): boolean {
  const prev = get().doc;
  const d = draft(prev);
  if (mutator(d) === false) return false;
  const now = Date.now();
  const merge = opts.key != null && opts.key === lastKey && now - lastTime < 1000;
  lastKey = opts.key ?? null;
  lastTime = now;
  const patch: Partial<EditorState> = { doc: d };
  if (!merge) {
    patch.past = [...get().past.slice(-199), { doc: prev, focus: currentCaret() }];
    patch.future = [];
  }
  if (opts.focus) patch.focusReq = { ...opts.focus, n: ++focusCounter };
  if (opts.select !== undefined) {
    const ids = opts.select ?? [];
    patch.selection = { ids, anchor: ids[0] ?? null, focus: ids[ids.length - 1] ?? null };
  }
  set(patch);
  emitChange(prev, d, 'local');
  return true;
}

function emitChange(prev: Doc, next: Doc, origin: ChangeOrigin) {
  const change = diffDocs(prev, next, origin);
  if (change) emit('change', change);
}

/**
 * Apply a change that is not an undo step of its own, e.g. a finished upload filling
 * in an image. It is applied to the undo / redo snapshots too, so stepping through
 * history never brings back the pre-change version. Sent to collaborators as usual.
 */
export function commitQuietly(mutator: (d: Doc) => void | boolean): boolean {
  const s = get();
  const apply = (doc: Doc) => {
    const d = draft(doc);
    return mutator(d) === false ? doc : d;
  };
  const next = apply(s.doc);
  if (next === s.doc) return false;
  const rebase = (stack: Snapshot[]) => stack.map((snap) => ({ ...snap, doc: apply(snap.doc) }));
  set({ doc: next, past: rebase(s.past), future: rebase(s.future) });
  emitChange(s.doc, next, 'local');
  return true;
}

/** Break history coalescing (e.g. after caret jumps). */
export function sealHistory() {
  lastKey = null;
}

function restore(from: 'past' | 'future') {
  const s = get();
  const stack = s[from];
  if (!stack.length) return;
  const snap = stack[stack.length - 1];
  const entry: Snapshot = { doc: s.doc, focus: currentCaret() };
  lastKey = null;
  const prevDoc = s.doc;
  set({
    doc: snap.doc,
    [from]: stack.slice(0, -1),
    [from === 'past' ? 'future' : 'past']: [...s[from === 'past' ? 'future' : 'past'], entry],
    selection: EMPTY_SEL,
    slash: null,
    blockMenu: null,
    focusReq:
      snap.focus && snap.doc.blocks[snap.focus.id]
        ? { id: snap.focus.id, at: snap.focus.offset, n: ++focusCounter }
        : null,
  });
  emitChange(prevDoc, snap.doc, from === 'past' ? 'undo' : 'redo');
}

/**
 * Replace the whole document (e.g. after loading another page). Clears undo history
 * and transient UI state, and emits no `change` event.
 */
export function setDocument(doc: Doc) {
  lastKey = null;
  set({ doc, selection: EMPTY_SEL, focusReq: null, slash: null, blockMenu: null, past: [], future: [] });
}

export const undo = () => restore('past');
export const redo = () => restore('future');

export function requestFocus(id: string, at: FocusAt = 'end') {
  set({ focusReq: { id, at, n: ++focusCounter }, selection: EMPTY_SEL });
}

export function selectBlocks(ids: string[], anchor?: string | null, focus?: string | null) {
  const doc = get().doc;
  const top = topLevel(doc, ids);
  set({
    selection: {
      ids: top,
      anchor: anchor ?? top[0] ?? null,
      focus: focus ?? top[top.length - 1] ?? null,
    },
    slash: null,
  });
}

export function clearSelection() {
  if (get().selection.ids.length || get().blockMenu) set({ selection: EMPTY_SEL, blockMenu: null });
}

export function setFocusedId(id: string | null) {
  if (get().focusedId !== id) set({ focusedId: id });
}

export function setTitle(title: string) {
  commit((d) => {
    d.title = title;
  }, { key: 'title' });
}

export interface RemoteUpdate {
  /** Blocks to insert or replace, as complete block objects. */
  upsert?: Block[];
  /** Block ids to delete (callers send whole subtrees). */
  remove?: string[];
  rootIds?: string[];
  title?: string;
}

/**
 * Merge an update into a document (last writer wins per block). References to
 * blocks that no longer exist are dropped so concurrent edits can't leave dangling ids.
 */
function mergeUpdate(prev: Doc, update: RemoteUpdate): Doc {
  const d = draft(prev);
  for (const id of update.remove ?? []) delete d.blocks[id];
  for (const b of update.upsert ?? []) d.blocks[b.id] = b;
  if (update.rootIds) d.rootIds = [...update.rootIds];
  if (update.title !== undefined) d.title = update.title;
  const alive = (id: string) => !!d.blocks[id];
  if (!d.rootIds.every(alive)) d.rootIds = d.rootIds.filter(alive);
  const touched = new Set((update.upsert ?? []).map((b) => b.id));
  for (const id of update.remove ?? []) {
    const parent = prev.blocks[id]?.parentId;
    if (parent) touched.add(parent);
  }
  for (const id of touched) {
    const b = d.blocks[id];
    if (b && !b.children.every(alive)) w(d, id).children = b.children.filter(alive);
  }
  return d;
}

/**
 * Apply changes received from a collaborator, emitted with origin "remote" so
 * transports don't echo it back. The change is not an undo step of its own; it is
 * folded into the local history too, so undo reverts only this user's edits.
 */
export function applyRemote(update: RemoteUpdate) {
  const s = get();
  const prev = s.doc;
  const merged = mergeUpdate(prev, update);
  // A concurrent insert may have lost its place in a list; put it back.
  const d = repairOrphans(merged, prev);
  const rebase = (stack: Snapshot[]) =>
    stack.map((snap) => ({ ...snap, doc: repairOrphans(mergeUpdate(snap.doc, update), snap.doc) }));
  set({
    doc: d,
    selection: { ...s.selection, ids: s.selection.ids.filter((id) => d.blocks[id]) },
    past: rebase(s.past),
    future: rebase(s.future),
  });
  emitChange(prev, merged, 'remote');
  // The repair is this client's own change: send it, so every collaborator (and the
  // stored copy) ends up with the restored block instead of only this screen.
  if (d !== merged) emitChange(merged, d, 'local');
}

export function localPresence(): PresenceState {
  const s = get();
  return { blockId: s.focusedId, selection: s.selection.ids };
}

/** Emit a `presence` event whenever the local caret block or block selection changes. */
export function startPresenceEvents(): () => void {
  let last = '';
  return useEditor.subscribe(() => {
    const p = localPresence();
    const key = `${p.blockId}|${p.selection.join(',')}`;
    if (key === last) return;
    last = key;
    emit('presence', p);
  });
}
