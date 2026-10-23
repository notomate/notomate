import type { Block, BlockProps, BlockType, Doc } from './model/types';
import { canHaveChildren, isTextBlock } from './model/types';
import { contentOf, getSpec } from './blocks/registry';
import {
  addAfter,
  addNextFromEnter,
  cloneSubtree,
  createBlock,
  indent,
  insertAt,
  outdent,
  removeBlock,
  siblingsOf,
  topLevel,
  visibleOrder,
  w,
} from './model/tree';
import { commit, commitQuietly, requestFocus, useEditor } from './model/store';
import { splitHtmlAt, textLength } from './inline/splitHtml';
import { htmlToText } from './inline/sanitize';

const doc = () => useEditor.getState().doc;

export interface Fragment {
  blocks: Record<string, Block>;
  rootIds: string[];
}

export function setHtml(id: string, html: string) {
  if (doc().blocks[id]?.html === html) return;
  commit((d) => {
    if (!d.blocks[id]) return false;
    w(d, id).html = html;
  }, { key: `text:${id}` });
}

export function setProps(ids: string[], patch: Partial<BlockProps>) {
  commit((d) => {
    for (const id of ids) if (d.blocks[id]) Object.assign(w(d, id).props, patch);
  });
}

/** `setProps` without an undo step of its own (see `commitQuietly`). */
export function setPropsQuietly(ids: string[], patch: Partial<BlockProps>) {
  commitQuietly((d) => {
    let any = false;
    for (const id of ids) {
      if (!d.blocks[id]) continue;
      Object.assign(w(d, id).props, patch);
      any = true;
    }
    return any;
  });
}

export function neighborText(id: string, dir: -1 | 1): string | null {
  const d = doc();
  const order = visibleOrder(d);
  for (let i = order.indexOf(id) + dir; i >= 0 && i < order.length; i += dir) {
    if (isTextBlock(d.blocks[order[i]])) return order[i];
  }
  return null;
}

export function neighborVisible(id: string, dir: -1 | 1): string | null {
  const order = visibleOrder(doc());
  const i = order.indexOf(id) + dir;
  return order[i] ?? null;
}

/** Enter key: split the block at the given text range. */
export function splitBlock(id: string, start: number, end: number) {
  const b = doc().blocks[id];
  if (!b) return;
  const spec = getSpec(b.type);
  const empty = !htmlToText(b.html).trim() && start === 0;

  if (empty && spec?.exitOnEmpty) {
    // Empty list item: step out of the list instead of creating another one.
    if (b.parentId) {
      commit((d) => outdent(d, id), { focus: { id, at: 'start' } });
    } else {
      commit((d) => {
        const x = w(d, id);
        x.type = 'paragraph';
        x.props = {};
      }, { focus: { id, at: 'start' } });
    }
    return;
  }

  // A closed collapsible block also continues: its children are hidden, so a sibling is expected.
  const nextType: BlockType = spec?.continues || (spec?.collapsible && !b.props.open) ? b.type : 'paragraph';

  if (start === 0 && end === 0 && b.html) {
    // Caret at the very start: push an empty block above and keep editing here.
    const fresh = createBlock(spec?.continues ? b.type : 'paragraph', '', spec?.continues ? spec.props : {});
    commit((d) => {
      d.blocks[fresh.id] = fresh;
      insertAt(d, fresh.id, b.parentId, siblingsOf(d, id).indexOf(id));
    }, { focus: { id, at: 'start' } });
    return;
  }

  const [before, after] = splitHtmlAt(b.html, start, end);
  const next = createBlock(nextType, after, spec?.continues ? spec.props : {});
  commit((d) => {
    w(d, id).html = before;
    addNextFromEnter(d, next, id);
  }, { focus: { id: next.id, at: 'start' } });
}

/** Append `srcId` content to `targetId`; src's children take src's place. */
function mergeInto(d: Doc, targetId: string, srcId: string) {
  const src = d.blocks[srcId];
  w(d, targetId).html += src.html;
  const list = siblingsOf(d, srcId);
  const index = list.indexOf(srcId);
  const kids = [...src.children];
  w(d, srcId).children = [];
  removeBlock(d, srcId);
  kids.forEach((k, i) => insertAt(d, k, src.parentId, index + i));
}

/** Backspace with the caret at offset 0. */
export function backspaceAtStart(id: string) {
  const b = doc().blocks[id];
  if (!b) return;
  if (b.type !== 'paragraph') {
    commit((d) => {
      const x = w(d, id);
      x.type = 'paragraph';
      x.props = {};
    }, { focus: { id, at: 'start' } });
    return;
  }
  if (b.parentId) {
    commit((d) => outdent(d, id), { focus: { id, at: 'start' } });
    return;
  }
  const prev = neighborVisible(id, -1);
  if (!prev) return;
  const p = doc().blocks[prev];
  if (!isTextBlock(p)) {
    if (!b.html) commit((d) => removeBlock(d, id), { select: [prev] });
    else useEditor.setState({ selection: { ids: [prev], anchor: prev, focus: prev } });
    (document.activeElement as HTMLElement | null)?.blur();
    return;
  }
  const at = textLength(p.html);
  commit((d) => mergeInto(d, prev, id), { focus: { id: prev, at } });
}

/** Delete key with the caret at the end: pull the next text block up. */
export function deleteAtEnd(id: string) {
  const next = neighborVisible(id, 1);
  if (!next) return;
  const n = doc().blocks[next];
  const at = textLength(doc().blocks[id].html);
  if (!isTextBlock(n)) {
    // Never delete an image / embed from the keyboard while typing: select it, so a
    // second Delete (now acting on the block selection) is a deliberate choice.
    useEditor.setState({ selection: { ids: [next], anchor: next, focus: next } });
    (document.activeElement as HTMLElement | null)?.blur();
    return;
  }
  commit((d) => mergeInto(d, id, next), { focus: { id, at } });
}

export function indentBlocks(ids: string[], focus?: { id: string; at: number }) {
  return commit((d) => {
    let any = false;
    for (const id of topLevel(d, ids)) any = indent(d, id) || any;
    return any;
  }, { focus: focus ? { id: focus.id, at: focus.at } : undefined });
}

export function outdentBlocks(ids: string[], focus?: { id: string; at: number }) {
  return commit((d) => {
    let any = false;
    for (const id of [...topLevel(d, ids)].reverse()) any = outdent(d, id) || any;
    return any;
  }, { focus: focus ? { id: focus.id, at: focus.at } : undefined });
}

export function turnInto(ids: string[], type: BlockType, opts: { focus?: boolean } = {}) {
  const first = ids[0];
  const spec = getSpec(type);
  const textual = contentOf(type) !== 'none';
  commit((d) => {
    for (const id of ids) {
      const x = w(d, id);
      x.type = type;
      if (!textual) x.html = '';
      x.props = { ...spec?.props, ...x.props };
      if (!canHaveChildren(x) && x.children.length) {
        // Leaf blocks cannot hold children: hoist them after the block.
        const kids = [...x.children].reverse();
        x.children = [];
        for (const k of kids) {
          const list = siblingsOf(d, id);
          insertAt(d, k, x.parentId, list.indexOf(id) + 1);
        }
      }
    }
  }, opts.focus && first && textual ? { focus: { id: first, at: 'end' } } : {});
}

/** Insert a fresh block after `afterId`, focus it (text) or select it (non-text). */
export function insertBlockAfter(afterId: string | null, type: BlockType = 'paragraph', props: BlockProps = {}) {
  const b = createBlock(type, '', props);
  const focusable = isTextBlock(b);
  commit((d) => addAfter(d, b, afterId), focusable ? { focus: { id: b.id, at: 'start' } } : { select: [b.id] });
  return b.id;
}

/** Click below the last block: reuse a trailing empty paragraph, or add one. */
export function extendPage() {
  const d = doc();
  const lastRoot = d.rootIds[d.rootIds.length - 1];
  const b = d.blocks[lastRoot];
  if (b && b.type === 'paragraph' && !b.html && !b.children.length) requestFocus(lastRoot, 'start');
  else insertBlockAfter(lastRoot ?? null);
}

export function deleteBlocks(ids: string[]) {
  const d0 = doc();
  const top = topLevel(d0, ids);
  if (!top.length) return;
  const order = visibleOrder(d0);
  const removed = new Set<string>();
  const markSubtree = (id: string) => {
    removed.add(id);
    d0.blocks[id].children.forEach(markSubtree);
  };
  top.forEach(markSubtree);
  const firstIdx = order.indexOf(top[0]);
  const before = order.slice(0, firstIdx).reverse().find((id) => isTextBlock(d0.blocks[id]));
  const after = order.slice(firstIdx).find((id) => !removed.has(id) && isTextBlock(d0.blocks[id]));
  let fallback: Block | null = null;
  commit((d) => {
    for (const id of top) removeBlock(d, id);
    if (!d.rootIds.length) {
      fallback = createBlock();
      addAfter(d, fallback, null);
    }
  }, { select: null });
  const target = (fallback as Block | null)?.id ?? before ?? after;
  if (target) requestFocus(target, before === target ? 'end' : 'start');
}

export function duplicateBlocks(ids: string[]) {
  const d0 = doc();
  const top = topLevel(d0, ids);
  if (!top.length) return;
  const into: Record<string, Block> = {};
  const copies = top.map((id) => cloneSubtree(d0, id, into));
  const last = top[top.length - 1];
  commit((d) => {
    Object.assign(d.blocks, into);
    const parent = d.blocks[last].parentId;
    const base = siblingsOf(d, last).indexOf(last) + 1;
    copies.forEach((c, i) => insertAt(d, c, parent, base + i));
  }, { select: copies });
}

export function fragmentOf(ids: string[]): Fragment {
  const d0 = doc();
  const blocks: Record<string, Block> = {};
  const rootIds = topLevel(d0, ids).map((id) => cloneSubtree(d0, id, blocks));
  return { blocks, rootIds };
}

/**
 * Insert a fragment after `afterId`. An empty paragraph at `afterId` is replaced.
 * Returns the inserted top-level ids.
 */
export function insertFragment(afterId: string | null, frag: Fragment, opts: { select?: boolean } = {}): string[] {
  const d0 = doc();
  const into: Record<string, Block> = {};
  const ids = frag.rootIds.map((id) => cloneSubtree(frag, id, into));
  if (!ids.length) return [];
  const replace =
    afterId && d0.blocks[afterId]?.type === 'paragraph' && !d0.blocks[afterId].html && !d0.blocks[afterId].children.length
      ? afterId
      : null;
  const lastId = ids[ids.length - 1];
  const lastIsText = isTextBlock(into[lastId]);
  commit((d) => {
    Object.assign(d.blocks, into);
    if (afterId === null) {
      ids.forEach((id, i) => insertAt(d, id, null, i));
      return;
    }
    const anchor = d.blocks[afterId];
    const base = siblingsOf(d, afterId).indexOf(afterId) + 1;
    ids.forEach((id, i) => insertAt(d, id, anchor.parentId, base + i));
    if (replace) removeBlock(d, replace);
  }, opts.select || !lastIsText ? { select: ids } : { focus: { id: lastId, at: 'end' } });
  return ids;
}

export function toggleOpen(id: string) {
  commit((d) => {
    const x = w(d, id);
    x.props.open = !x.props.open;
  });
}
