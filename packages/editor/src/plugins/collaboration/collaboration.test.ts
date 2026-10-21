import { afterEach, describe, expect, it } from 'vitest';
import { applyRemote, commit, setDocument, undo, useEditor } from '../../editor/model/store';
import { addAfter, createBlock, removeBlock, w } from '../../editor/model/tree';
import { on, type DocChange } from '../../editor/events';
import type { Doc } from '../../editor/model/types';
import { broadcastChannelSync, updateFromChange, type CollaborationConnection, type DocUpdate } from './index';

function doc2(): Doc {
  const a = { ...createBlock('paragraph', 'A'), id: 'a' };
  const b = { ...createBlock('paragraph', 'B'), id: 'b' };
  return { title: 't', blocks: { a, b }, rootIds: ['a', 'b'] };
}

let off = () => {};
afterEach(() => off());

function lastChange() {
  let last: DocChange | null = null;
  off = on('change', (c) => (last = c));
  return () => last!;
}

describe('collaboration', () => {
  it('turns a local change into an update that reproduces it elsewhere', () => {
    const start = doc2();
    setDocument(start);
    const change = lastChange();
    const c = createBlock('paragraph', 'C');
    commit((d) => {
      w(d, 'a').html = 'A!';
      addAfter(d, c, 'a');
      removeBlock(d, 'b');
      d.title = 'new';
    });
    const local = useEditor.getState().doc;

    setDocument(start);
    applyRemote(updateFromChange(change()));
    const remote = useEditor.getState().doc;
    expect(remote.rootIds).toEqual(local.rootIds);
    expect(remote.title).toBe('new');
    expect(Object.keys(remote.blocks).sort()).toEqual(Object.keys(local.blocks).sort());
    expect(remote.blocks.a.html).toBe('A!');
  });

  it("undo reverts only this user's edits, not a collaborator's", () => {
    setDocument(doc2());
    commit((d) => {
      w(d, 'a').html = 'mine';
    });
    applyRemote({ upsert: [{ ...useEditor.getState().doc.blocks.b, html: 'theirs' }] });
    undo();
    const d = useEditor.getState().doc;
    expect(d.blocks.a.html).toBe('A');
    expect(d.blocks.b.html).toBe('theirs');
  });

  it('drops references to blocks a concurrent edit removed', () => {
    setDocument(doc2());
    applyRemote({ remove: ['b'] });
    expect(useEditor.getState().doc.rootIds).toEqual(['a']);
    const parent = { ...createBlock('toggle', 'P'), id: 'p', children: ['a', 'ghost'] };
    applyRemote({ upsert: [parent, { ...useEditor.getState().doc.blocks.a, parentId: 'p' }], rootIds: ['p', 'gone'] });
    const d = useEditor.getState().doc;
    expect(d.rootIds).toEqual(['p']);
    expect(d.blocks.p.children).toEqual(['a']);
  });

  it('broadcastChannelSync: a joining tab adopts the open document, then edits flow', async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const peer = (initial: Doc) => {
      const state = { doc: initial, applied: [] as DocUpdate[], emit: (_u: DocUpdate) => {} };
      const conn: CollaborationConnection = {
        getDoc: () => state.doc,
        loadDoc: (d) => (state.doc = d),
        applyUpdate: (u) => state.applied.push(u),
        onLocalUpdate: (fn) => {
          state.emit = fn;
          return () => {};
        },
      };
      return { state, conn };
    };
    const channel = `test-${Math.random()}`;
    const a = peer({ ...doc2(), title: 'from A' });
    const b = peer({ ...doc2(), title: 'from B' });
    const stopA = broadcastChannelSync({ channel })(a.conn);
    await wait(600);
    const stopB = broadcastChannelSync({ channel })(b.conn);
    await wait(100);
    expect(b.state.doc.title).toBe('from A');

    a.state.emit({ title: 'edited' });
    await wait(50);
    expect(b.state.applied).toEqual([{ title: 'edited' }]);
    expect(a.state.applied).toEqual([]);
    stopA();
    stopB();
  });
});
