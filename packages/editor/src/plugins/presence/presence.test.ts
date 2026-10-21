import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '../../editor/components/Editor';
import { selectBlocks } from '../../editor/model/store';
import type { PresenceState } from '../../editor/events';
import { presence, usePresence, type PresenceConnection } from './index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;

describe('presence plugin', () => {
  it('connects a transport, renders peers, and disconnects on unmount', () => {
    let conn: PresenceConnection | null = null;
    const sent: PresenceState[] = [];
    let disconnected = 0;
    const plugin = presence({
      user: { id: 'me', name: 'Me', color: 'blue' },
      transport: (c) => {
        conn = c;
        const off = c.onLocalChange((p) => sent.push(p));
        return () => {
          off();
          disconnected++;
        };
      },
    });

    const el = document.createElement('div');
    document.body.append(el);
    const root = createRoot(el);
    act(() =>
      root.render(
        createElement(Editor, {
          plugins: [plugin],
          defaultDoc: { title: '', blocks: { a: { id: 'a', type: 'paragraph', html: 'x', props: {}, children: [], parentId: null } }, rootIds: ['a'] },
        }),
      ),
    );
    expect(conn!.me.id).toBe('me');
    expect(el.querySelector('.presence-bar')).not.toBeNull();

    act(() => selectBlocks(['a']));
    expect(sent.at(-1)).toEqual({ blockId: null, selection: ['a'] });

    act(() => conn!.upsertPeer({ id: 'p1', name: 'A', color: 'red', blockId: 'a' }));
    act(() => conn!.upsertPeer({ id: 'me', name: 'Me', color: 'blue', blockId: 'a' }));
    expect(Object.keys(usePresence.getState().peers)).toEqual(['p1']);
    expect(el.querySelector('[data-block-id="a"] .peer-ring.text .peer-tag')?.textContent).toBe('A');

    act(() => root.unmount());
    expect(disconnected).toBe(1);
    expect(usePresence.getState()).toEqual({ me: null, peers: {} });
    el.remove();
  });
});
