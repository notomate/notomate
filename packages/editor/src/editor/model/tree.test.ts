import { describe, expect, it } from 'vitest';
import type { Block, BlockType, Doc } from './types';
import {
  createBlock,
  draft,
  indent,
  listNumber,
  moveBlocks,
  outdent,
  rangeBetween,
  removeBlock,
  topLevel,
  visibleOrder,
} from './tree';
import { setBlocks } from '../blocks/registry';
import { allBlocks } from '../blocks/builtins';

setBlocks(allBlocks);

/** a, b(c, d), e — with readable ids. */
function fixture(): Doc {
  const mk = (id: string, type: BlockType = 'paragraph', children: string[] = [], parentId: string | null = null): Block => ({
    ...createBlock(type, id),
    id,
    children,
    parentId,
  });
  const blocks = {
    a: mk('a'),
    b: mk('b', 'bullet', ['c', 'd']),
    c: mk('c', 'bullet', [], 'b'),
    d: mk('d', 'bullet', [], 'b'),
    e: mk('e'),
  };
  return { title: '', blocks, rootIds: ['a', 'b', 'e'] };
}

describe('tree', () => {
  it('orders visible blocks depth-first and hides collapsed toggles', () => {
    const doc = fixture();
    expect(visibleOrder(doc)).toEqual(['a', 'b', 'c', 'd', 'e']);
    doc.blocks.b = { ...doc.blocks.b, type: 'toggle', props: { open: false } };
    expect(visibleOrder(doc)).toEqual(['a', 'b', 'e']);
  });

  it('reduces selections to top-level blocks', () => {
    const doc = fixture();
    expect(topLevel(doc, ['c', 'b', 'e'])).toEqual(['b', 'e']);
    expect(rangeBetween(doc, 'e', 'c')).toEqual(['c', 'd', 'e']);
    expect(rangeBetween(doc, 'a', 'd')).toEqual(['a', 'b']);
  });

  it('indents into the previous sibling and outdents with following siblings', () => {
    const d = draft(fixture());
    expect(indent(d, 'e')).toBe(true);
    expect(d.blocks.b.children).toEqual(['c', 'd', 'e']);
    expect(d.blocks.e.parentId).toBe('b');
    expect(indent(d, 'a')).toBe(false);

    expect(outdent(d, 'c')).toBe(true);
    expect(d.rootIds).toEqual(['a', 'b', 'c']);
    expect(d.blocks.b.children).toEqual([]);
    expect(d.blocks.c.children).toEqual(['d', 'e']);
  });

  it('does not mutate the source document', () => {
    const doc = fixture();
    const d = draft(doc);
    indent(d, 'e');
    expect(doc.rootIds).toEqual(['a', 'b', 'e']);
    expect(doc.blocks.b.children).toEqual(['c', 'd']);
  });

  it('moves blocks before, after and inside targets', () => {
    let d = draft(fixture());
    expect(moveBlocks(d, ['e'], 'a', 'before')).toBe(true);
    expect(d.rootIds).toEqual(['e', 'a', 'b']);

    d = draft(fixture());
    expect(moveBlocks(d, ['a', 'e'], 'c', 'after')).toBe(true);
    expect(d.rootIds).toEqual(['b']);
    expect(d.blocks.b.children).toEqual(['c', 'a', 'e', 'd']);
    expect(d.blocks.a.parentId).toBe('b');

    d = draft(fixture());
    expect(moveBlocks(d, ['a'], 'e', 'inside')).toBe(true);
    expect(d.blocks.e.children).toEqual(['a']);
  });

  it('refuses to drop a block into its own subtree', () => {
    const d = draft(fixture());
    expect(moveBlocks(d, ['b'], 'c', 'after')).toBe(false);
    expect(moveBlocks(d, ['b'], 'b', 'before')).toBe(false);
  });

  it('removes whole subtrees', () => {
    const d = draft(fixture());
    removeBlock(d, 'b');
    expect(d.rootIds).toEqual(['a', 'e']);
    expect(Object.keys(d.blocks).sort()).toEqual(['a', 'e']);
  });

  it('numbers consecutive numbered siblings', () => {
    const doc = fixture();
    for (const id of ['a', 'b', 'e']) doc.blocks[id] = { ...doc.blocks[id], type: 'numbered' };
    expect(listNumber(doc, 'e')).toBe(3);
    doc.blocks.b = { ...doc.blocks.b, type: 'paragraph' };
    expect(listNumber(doc, 'e')).toBe(1);
  });
});
