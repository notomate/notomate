import { afterEach, describe, expect, it } from 'vitest';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { setBlocks, type BlockSpec } from './registry';
import { allBlocks, paragraph, todoList } from './builtins';
import { matchShortcut } from '../markdownShortcuts';
import { fragmentFromText } from '../clipboard';
import { commands } from '../commands';
import { Editor } from '../components/Editor';
import { BlockText } from '../components/BlockText';
import { createBlock } from '../model/tree';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no matchMedia.
window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;

afterEach(() => setBlocks(allBlocks));

describe('block registry', () => {
  it('only knows paragraph by default', () => {
    setBlocks([paragraph]);
    expect(commands().map((c) => c.type)).toEqual(['paragraph']);
    expect(matchShortcut('# ', 2)).toBeNull();
    const f = fragmentFromText('# Title\n- one\n```\ncode\n```');
    expect(f.rootIds.map((id) => f.blocks[id].type)).toEqual(Array(5).fill('paragraph'));
  });

  it('enables only the blocks that are installed', () => {
    setBlocks([paragraph, todoList]);
    expect(commands().map((c) => c.type)).toEqual(['paragraph', 'todo']);
    expect(matchShortcut('[] ', 3)?.type).toBe('todo');
    expect(matchShortcut('- ', 2)).toBeNull();
    const f = fragmentFromText('- [x] done\n- plain');
    expect(f.rootIds.map((id) => [f.blocks[id].type, f.blocks[id].props.checked])).toEqual([
      ['todo', true],
      ['paragraph', undefined],
    ]);
  });

  it('renders custom blocks and falls back to text for unknown types', () => {
    const banner: BlockSpec = {
      type: 'banner',
      component: ({ block }) => createElement('div', { className: 'my-banner' }, createElement(BlockText, { block })),
      menu: { label: 'Banner', icon: '📣' },
      inputRules: [{ pattern: /^!!\s$/ }],
    };
    const a = { ...createBlock('banner', 'hi'), id: 'a' };
    const b = { ...createBlock('h1', 'orphan'), id: 'b' };
    const el = document.createElement('div');
    document.body.append(el);
    const root = createRoot(el);
    act(() =>
      root.render(
        createElement(Editor, {
          blocks: [banner],
          defaultDoc: { title: '', blocks: { a, b }, rootIds: ['a', 'b'] },
        }),
      ),
    );
    expect(el.querySelector('.my-banner [data-editable-id="a"]')?.innerHTML).toBe('hi');
    expect(el.querySelector('[data-editable-id="b"]')?.innerHTML).toBe('orphan');
    expect(commands().map((c) => c.type)).toEqual(['paragraph', 'banner']);
    expect(matchShortcut('!! ', 3)?.type).toBe('banner');
    act(() => root.unmount());
    el.remove();
  });
});
