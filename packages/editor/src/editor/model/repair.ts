import type { Doc } from './types';

/**
 * Re-attach blocks that no list references any more.
 *
 * Collaboration merges per block, last writer wins, so when two people insert into
 * the same parent at once, one side's `children` / `rootIds` overwrites the other's
 * and the losing insert is left orphaned. An orphan goes back after the sibling it
 * followed in `before` (or at the end), and an orphan whose parent was deleted is
 * dropped with its subtree, as if it had been inside the deleted block.
 *
 * Returns `doc` itself when nothing needed fixing. Pure, so the collab server can
 * use it too.
 */
export function repairOrphans(doc: Doc, before?: Doc): Doc {
  const referenced = new Set(doc.rootIds);
  for (const id in doc.blocks) for (const c of doc.blocks[id].children) referenced.add(c);
  const orphans = Object.keys(doc.blocks).filter((id) => !referenced.has(id));
  if (!orphans.length) return doc;

  const blocks = { ...doc.blocks };
  let rootIds = doc.rootIds;
  const drop = (id: string) => {
    const b = blocks[id];
    if (!b) return;
    delete blocks[id];
    b.children.forEach(drop);
  };

  // Parents first, so a re-attached child finds its re-attached parent.
  const depth = (id: string) => {
    let n = 0;
    for (let p = doc.blocks[id]?.parentId; p && n < 1000; p = doc.blocks[p]?.parentId) n++;
    return n;
  };
  for (const id of orphans.sort((a, b) => depth(a) - depth(b))) {
    const b = blocks[id];
    if (!b) continue;
    const parentId = b.parentId;
    if (parentId && (!blocks[parentId] || isWithin(blocks, parentId, id))) {
      drop(id);
      continue;
    }
    const list = parentId ? [...blocks[parentId].children] : [...rootIds];
    const old = before ? (parentId ? before.blocks[parentId]?.children : before.rootIds) ?? [] : [];
    let at = list.length;
    for (let i = old.indexOf(id) - 1; i >= 0; i--) {
      const j = list.indexOf(old[i]);
      if (j >= 0) {
        at = j + 1;
        break;
      }
    }
    if (old.indexOf(id) === 0) at = 0;
    list.splice(at, 0, id);
    if (parentId) blocks[parentId] = { ...blocks[parentId], children: list };
    else rootIds = list;
  }
  return { ...doc, blocks, rootIds };
}

/** Whether `ancestor` is `id` or lies inside its subtree (re-attaching would form a cycle). */
function isWithin(blocks: Doc['blocks'], ancestor: string, id: string): boolean {
  for (let p: string | null = ancestor, n = 0; p && n < 1000; p = blocks[p]?.parentId ?? null, n++) {
    if (p === id) return true;
  }
  return false;
}
