import type { Doc } from './model/types';

/** Where a document change came from. Collaboration transports should only forward `local` / `undo` / `redo`. */
export type ChangeOrigin = 'local' | 'undo' | 'redo' | 'remote';

export interface DocChange {
  origin: ChangeOrigin;
  prev: Doc;
  next: Doc;
  /** Block ids present in `next` but not in `prev`. */
  added: string[];
  /** Blocks whose content, props, type, parent or children changed. */
  updated: string[];
  /** Block ids present in `prev` but not in `next` (whole subtrees). */
  removed: string[];
  /** Top-level block order changed. */
  orderChanged: boolean;
  titleChanged: boolean;
}

/** What this user is doing, for showing to collaborators. */
export interface PresenceState {
  /** Block whose text has the caret. */
  blockId: string | null;
  /** Blocks in block-selection mode. */
  selection: string[];
}

interface EventMap {
  change: DocChange;
  presence: PresenceState;
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

const listeners: { [K in keyof EventMap]: Set<Listener<K>> } = {
  change: new Set(),
  presence: new Set(),
};

/** Subscribe to editor events. Returns an unsubscribe function. */
export function on<K extends keyof EventMap>(type: K, fn: Listener<K>): () => void {
  listeners[type].add(fn);
  return () => listeners[type].delete(fn);
}

export function emit<K extends keyof EventMap>(type: K, payload: EventMap[K]) {
  for (const fn of listeners[type]) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[editor] ${type} listener failed`, err);
    }
  }
}

/**
 * Diff two document versions. Edits are copy-on-write, so an unchanged block keeps
 * its object identity and the comparison is a cheap reference check.
 */
export function diffDocs(prev: Doc, next: Doc, origin: ChangeOrigin): DocChange | null {
  const added: string[] = [];
  const updated: string[] = [];
  const removed: string[] = [];
  for (const id in next.blocks) {
    if (!(id in prev.blocks)) added.push(id);
    else if (prev.blocks[id] !== next.blocks[id]) updated.push(id);
  }
  for (const id in prev.blocks) if (!(id in next.blocks)) removed.push(id);
  const orderChanged =
    prev.rootIds !== next.rootIds &&
    (prev.rootIds.length !== next.rootIds.length || prev.rootIds.some((id, i) => next.rootIds[i] !== id));
  const titleChanged = prev.title !== next.title;
  if (!added.length && !updated.length && !removed.length && !orderChanged && !titleChanged) return null;
  return { origin, prev, next, added, updated, removed, orderChanged, titleChanged };
}
