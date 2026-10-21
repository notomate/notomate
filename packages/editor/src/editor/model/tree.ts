import type { Block, BlockType, Doc, DropPosition } from './types';
import { canHaveChildren } from './types';
import { getSpec, isCollapsed } from '../blocks/registry';

let counter = 0;
export const newId = () => Math.random().toString(36).slice(2, 10) + (counter++).toString(36);

export function createBlock(type: BlockType = 'paragraph', html = '', props: Block['props'] = {}): Block {
  return { id: newId(), type, html, props: { ...props }, children: [], parentId: null };
}

/** Shallow copy suitable for copy-on-write mutation through `w()`. */
export function draft(doc: Doc): Doc {
  return { ...doc, blocks: { ...doc.blocks }, rootIds: [...doc.rootIds] };
}

/** Clone a block inside a draft so it can be mutated safely. */
export function w(d: Doc, id: string): Block {
  const b = d.blocks[id];
  const copy = { ...b, props: { ...b.props }, children: [...b.children] };
  d.blocks[id] = copy;
  return copy;
}

function siblingList(d: Doc, parentId: string | null): string[] {
  return parentId ? w(d, parentId).children : d.rootIds;
}

export function siblingsOf(doc: Doc, id: string): string[] {
  const p = doc.blocks[id].parentId;
  return p ? doc.blocks[p].children : doc.rootIds;
}

export function prevSibling(doc: Doc, id: string): string | null {
  const s = siblingsOf(doc, id);
  const i = s.indexOf(id);
  return i > 0 ? s[i - 1] : null;
}

export function depthOf(doc: Doc, id: string): number {
  let depth = 0;
  let p = doc.blocks[id]?.parentId ?? null;
  while (p) {
    depth++;
    p = doc.blocks[p].parentId;
  }
  return depth;
}

export function isAncestor(doc: Doc, ancestorId: string, id: string): boolean {
  let p = doc.blocks[id]?.parentId ?? null;
  while (p) {
    if (p === ancestorId) return true;
    p = doc.blocks[p].parentId;
  }
  return false;
}

/** Depth-first order of rendered blocks (collapsed blocks hide their children). */
export function visibleOrder(doc: Doc): string[] {
  const out: string[] = [];
  const walk = (ids: string[]) => {
    for (const id of ids) {
      const b = doc.blocks[id];
      if (!b) continue;
      out.push(id);
      if (b.children.length && !isCollapsed(b)) walk(b.children);
    }
  };
  walk(doc.rootIds);
  return out;
}

/** Drop ids whose ancestor is also in the set; keep document order. */
export function topLevel(doc: Doc, ids: Iterable<string>): string[] {
  const set = new Set(ids);
  return visibleOrder(doc).filter((id) => {
    if (!set.has(id)) return false;
    let p = doc.blocks[id].parentId;
    while (p) {
      if (set.has(p)) return false;
      p = doc.blocks[p].parentId;
    }
    return true;
  });
}

/** Visible blocks between two ids (inclusive), reduced to top-level ones. */
export function rangeBetween(doc: Doc, a: string, b: string): string[] {
  const order = visibleOrder(doc);
  let i = order.indexOf(a);
  let j = order.indexOf(b);
  if (i < 0 || j < 0) return [];
  if (i > j) [i, j] = [j, i];
  return topLevel(doc, order.slice(i, j + 1));
}

export function detach(d: Doc, id: string) {
  const list = siblingList(d, d.blocks[id].parentId);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
}

export function insertAt(d: Doc, id: string, parentId: string | null, index: number) {
  const list = siblingList(d, parentId);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, id);
  w(d, id).parentId = parentId;
}

/** Add a new block to the draft right after `afterId` as a sibling (or first at root when null). */
export function addAfter(d: Doc, block: Block, afterId: string | null) {
  d.blocks[block.id] = block;
  if (afterId === null) {
    insertAt(d, block.id, null, 0);
    return;
  }
  const after = d.blocks[afterId];
  insertAt(d, block.id, after.parentId, siblingsOf(d, afterId).indexOf(afterId) + 1);
}

/**
 * Where Enter places the new block: as first child when the block shows children
 * (an open collapsible block, or any block with visible nested content), otherwise as next sibling.
 */
export function addNextFromEnter(d: Doc, block: Block, fromId: string) {
  const from = d.blocks[fromId];
  if (!isCollapsed(from) && (from.children.length > 0 || getSpec(from.type)?.collapsible)) {
    d.blocks[block.id] = block;
    insertAt(d, block.id, fromId, 0);
  } else {
    addAfter(d, block, fromId);
  }
}

export function removeBlock(d: Doc, id: string) {
  if (!d.blocks[id]) return;
  detach(d, id);
  const kill = (bid: string) => {
    const b = d.blocks[bid];
    if (!b) return;
    b.children.forEach(kill);
    delete d.blocks[bid];
  };
  kill(id);
}

/** Make `id` the last child of its previous sibling. */
export function indent(d: Doc, id: string): boolean {
  const prev = prevSibling(d, id);
  if (!prev || !canHaveChildren(d.blocks[prev])) return false;
  detach(d, id);
  const p = w(d, prev);
  p.children.push(id);
  if (getSpec(p.type)?.collapsible) p.props.open = true;
  w(d, id).parentId = prev;
  return true;
}

/** Move `id` out one level; following siblings become its children (Notion behaviour). */
export function outdent(d: Doc, id: string): boolean {
  const parentId = d.blocks[id].parentId;
  if (!parentId) return false;
  const parent = w(d, parentId);
  const following = parent.children.splice(parent.children.indexOf(id));
  following.shift();
  const self = w(d, id);
  if (following.length && canHaveChildren(self)) {
    self.children.push(...following);
    for (const f of following) w(d, f).parentId = id;
  } else {
    parent.children.push(...following);
  }
  const grandList = siblingList(d, parent.parentId);
  grandList.splice(grandList.indexOf(parentId) + 1, 0, id);
  self.parentId = parent.parentId;
  return true;
}

/** Move a set of blocks relative to a target. Returns false for invalid drops. */
export function moveBlocks(d: Doc, ids: string[], targetId: string, pos: DropPosition): boolean {
  const moving = topLevel(d, ids);
  if (!moving.length || !d.blocks[targetId]) return false;
  if (moving.includes(targetId) || moving.some((m) => isAncestor(d, m, targetId))) return false;
  if (pos === 'inside' && !canHaveChildren(d.blocks[targetId])) pos = 'after';
  for (const m of moving) detach(d, m);
  if (pos === 'inside') {
    moving.forEach((m, k) => insertAt(d, m, targetId, k));
    if (getSpec(d.blocks[targetId].type)?.collapsible) w(d, targetId).props.open = true;
  } else {
    const target = d.blocks[targetId];
    const base = siblingsOf(d, targetId).indexOf(targetId) + (pos === 'after' ? 1 : 0);
    moving.forEach((m, k) => insertAt(d, m, target.parentId, base + k));
  }
  return true;
}

/** Deep copy a subtree with fresh ids into `into`. Returns the new root id. */
export function cloneSubtree(
  src: Pick<Doc, 'blocks'>,
  id: string,
  into: Record<string, Block>,
  parentId: string | null = null,
): string {
  const b = src.blocks[id];
  const copy: Block = { ...b, id: newId(), props: { ...b.props }, parentId, children: [] };
  into[copy.id] = copy;
  copy.children = b.children.map((c) => cloneSubtree(src, c, into, copy.id));
  return copy.id;
}

/** Index among consecutive siblings of the same type (1-based), e.g. a numbered list item's number. */
export function listNumber(doc: Doc, id: string): number {
  const s = siblingsOf(doc, id);
  const type = doc.blocks[id].type;
  let n = 1;
  for (let i = s.indexOf(id) - 1; i >= 0 && doc.blocks[s[i]].type === type; i--) n++;
  return n;
}

export function emptyDoc(): Doc {
  const b = createBlock();
  return { title: '', blocks: { [b.id]: b }, rootIds: [b.id] };
}
