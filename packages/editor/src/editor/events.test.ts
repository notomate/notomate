import { afterEach, describe, expect, it } from 'vitest';
import { applyRemote, commit, undo, useEditor } from './model/store';
import { createBlock, emptyDoc, w } from './model/tree';
import { on, type DocChange } from './events';
import { upsertPeer, usePresence } from '../plugins/presence/store';
import { setBlocks } from './blocks/registry';
import { allBlocks } from './blocks/builtins';

setBlocks(allBlocks);

function record() {
  const seen: DocChange[] = [];
  const off = on('change', (c) => seen.push(c));
  return { seen, off };
}

describe('change events', () => {
  let off = () => {};
  afterEach(() => off());

  it('reports updated, added and removed blocks with their origin', () => {
    const doc = emptyDoc();
    useEditor.setState({ doc, past: [], future: [] });
    const first = doc.rootIds[0];
    const r = record();
    off = r.off;

    commit((d) => {
      w(d, first).html = 'hello';
    });
    expect(r.seen[0]).toMatchObject({ origin: 'local', updated: [first], added: [], removed: [] });

    const extra = createBlock('paragraph', 'x');
    commit((d) => {
      d.blocks[extra.id] = extra;
      d.rootIds.push(extra.id);
    });
    expect(r.seen[1]).toMatchObject({ added: [extra.id], orderChanged: true });

    undo();
    expect(r.seen[2]).toMatchObject({ origin: 'undo', removed: [extra.id], orderChanged: true });
  });

  it('applies remote updates without touching undo history', () => {
    const doc = emptyDoc();
    useEditor.setState({ doc, past: [], future: [] });
    const r = record();
    off = r.off;
    const b = { ...doc.blocks[doc.rootIds[0]], html: 'from peer' };
    applyRemote({ upsert: [b], title: 'Shared' });
    expect(useEditor.getState().doc.blocks[b.id].html).toBe('from peer');
    expect(useEditor.getState().past).toHaveLength(0);
    expect(r.seen[0]).toMatchObject({ origin: 'remote', updated: [b.id], titleChanged: true });
  });

  it('a null blockId clears the peer caret block', () => {
    upsertPeer({ id: 'p1', name: 'A', color: 'red', blockId: 'b1' });
    upsertPeer({ id: 'p1', name: 'A', color: 'red', blockId: null });
    expect(usePresence.getState().peers.p1.blockId).toBeNull();
  });
});
