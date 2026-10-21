import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Editor } from './components/Editor';
import { getSpec, setBlocks, type BlockSpec } from './blocks/registry';
import { allBlocks, image, paragraph } from './blocks/builtins';
import { commands } from './commands';
import { applyRemote, setDocument, undo, useEditor } from './model/store';
import { createBlock } from './model/tree';
import { repairOrphans } from './model/repair';
import { on, type DocChange } from './events';
import { deleteAtEnd, setProps, setPropsQuietly } from './ops';
import { setMessages } from './messages';
import { sanitizeInline } from './inline/sanitize';
import { fragmentFromHtml } from './clipboard';
import { applyTrigger, setTriggers, triggerItems, updateTrigger, useTrigger } from './triggers';
import { runTransfer, setPlugins } from './plugins';
import type { Block, Doc } from './model/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as never;

const block = (id: string, html = id, extra: Partial<Block> = {}): Block => ({
  ...createBlock('paragraph', html),
  id,
  ...extra,
});

function docOf(blocks: Block[], rootIds: string[]): Doc {
  return { title: '', blocks: Object.fromEntries(blocks.map((b) => [b.id, b])), rootIds };
}

let cleanup: (() => void)[] = [];
afterEach(() => {
  cleanup.forEach((c) => c());
  cleanup = [];
  setBlocks(allBlocks);
  setPlugins([]);
  setTriggers([]);
});

function mount(props: Parameters<typeof Editor>[0]) {
  const el = document.createElement('div');
  document.body.append(el);
  let root!: Root;
  act(() => {
    root = createRoot(el);
    root.render(createElement(Editor, props));
  });
  cleanup.push(() => {
    act(() => root.unmount());
    el.remove();
  });
  return el;
}

describe('repairOrphans (A8)', () => {
  it('puts back a concurrent insert that lost its place, after the sibling it followed', () => {
    const before = docOf([block('a'), block('x'), block('b')], ['a', 'x', 'b']);
    // A collaborator inserted y at the same spot; their rootIds overwrote ours.
    const merged = docOf([block('a'), block('x'), block('y'), block('b')], ['a', 'y', 'b']);
    expect(repairOrphans(merged, before).rootIds).toEqual(['a', 'x', 'y', 'b']);
  });

  it('re-attaches children of nested lists and drops blocks whose parent was deleted', () => {
    const p = block('p', 'p', { children: ['c1'] });
    const kid = block('c2', 'c2', { parentId: 'p' });
    const lost = block('l', 'l', { parentId: 'gone', children: ['l2'] });
    const lost2 = block('l2', 'l2', { parentId: 'l' });
    const merged = docOf([p, block('c1', 'c1', { parentId: 'p' }), kid, lost, lost2], ['p']);
    const fixed = repairOrphans(merged);
    expect(fixed.blocks.p.children).toEqual(['c1', 'c2']);
    expect(fixed.blocks.l).toBeUndefined();
    expect(fixed.blocks.l2).toBeUndefined();
  });

  it('returns the same document when nothing is orphaned', () => {
    const d = docOf([block('a')], ['a']);
    expect(repairOrphans(d)).toBe(d);
  });

  it('applyRemote repairs and sends the repair as a local change', () => {
    setDocument(docOf([block('a'), block('x'), block('b')], ['a', 'x', 'b']));
    const seen: DocChange[] = [];
    const off = on('change', (c) => seen.push(c));
    cleanup.push(off);
    applyRemote({ upsert: [block('y')], rootIds: ['a', 'y', 'b'] });
    expect(useEditor.getState().doc.rootIds).toEqual(['a', 'x', 'y', 'b']);
    expect(seen.map((c) => c.origin)).toEqual(['remote', 'local']);
    expect(seen[1].next.rootIds).toEqual(['a', 'x', 'y', 'b']);
  });
});

describe('Delete at the end of a block (A7)', () => {
  it('selects the next non-text block instead of deleting it', () => {
    setBlocks([paragraph, image]);
    const img = { ...createBlock('image', '', { src: '/x.png' }), id: 'img' };
    setDocument(docOf([block('a'), img], ['a', 'img']));
    deleteAtEnd('a');
    const s = useEditor.getState();
    expect(s.doc.blocks.img).toBeDefined();
    expect(s.selection.ids).toEqual(['img']);
  });
});

describe('inline whitelist (A2)', () => {
  it('keeps comment and mention spans, drops unknown spans', () => {
    expect(sanitizeInline('<span data-comment-thread-id="t-1" class="x">hi</span>')).toBe(
      '<span data-comment-thread-id="t-1">hi</span>',
    );
    expect(sanitizeInline('<span data-mention="" data-id="u1" data-label="Amy" onclick="x()"><b>@Amy</b></span>')).toBe(
      '<span data-mention="" data-id="u1" data-label="Amy" contenteditable="false">@Amy</span>',
    );
    expect(sanitizeInline('<span data-evil="1">plain</span>')).toBe('plain');
  });
});

describe('slash menu groups and visibility (A4)', () => {
  it('groups entries by section in order of first use and hides on demand', () => {
    let maps = false;
    const spec = (type: string, group?: string, hidden?: () => boolean): BlockSpec => ({
      type,
      component: () => null,
      content: 'none',
      menu: { label: type, icon: type, group, hidden },
    });
    setBlocks([paragraph, spec('video', 'Media'), spec('h9'), spec('map', 'Embeds', () => !maps), spec('audio', 'Media')]);
    expect(commands().map((c) => `${c.group}:${c.type}`)).toEqual([':paragraph', ':h9', 'Media:video', 'Media:audio']);
    maps = true;
    expect(commands().map((c) => c.type)).toContain('map');
  });
});

describe('inline triggers (A3)', () => {
  it('opens on "@" at a word start, filters, and inserts the chosen chip', () => {
    setTriggers([
      {
        char: '@',
        items: (q) =>
          ['Amy', 'Ben'].filter((n) => n.toLowerCase().startsWith(q.toLowerCase())).map((n) => ({
            id: n,
            label: n,
            html: `<span data-mention="" data-id="${n}" data-label="${n}" contenteditable="false">@${n}</span>`,
          })),
      },
    ]);
    setDocument(docOf([block('a', 'hi @b')], ['a']));
    updateTrigger('a', '@', 'hi @', 4);
    expect(useTrigger.getState().active).toMatchObject({ char: '@', from: 3 });
    updateTrigger('a', 'b', 'hi @b', 5);
    const active = useTrigger.getState().active!;
    expect(triggerItems(active).map((i) => i.id)).toEqual(['Ben']);
    applyTrigger(triggerItems(active)[0]);
    expect(useEditor.getState().doc.blocks.a.html).toBe(
      'hi <span data-mention="" data-id="Ben" data-label="Ben" contenteditable="false">@Ben</span>&nbsp;',
    );
    expect(useTrigger.getState().active).toBeNull();
  });

  it('does not open in the middle of a word', () => {
    setTriggers([{ char: '@', items: () => [] }]);
    updateTrigger('a', '@', 'mail@', 5);
    expect(useTrigger.getState().active).toBeNull();
  });
});

describe('paste / drop hooks (A6)', () => {
  it('offers the transfer to plugins in order until one handles it', () => {
    const first = vi.fn(() => false);
    const second = vi.fn(() => true);
    const third = vi.fn(() => true);
    setPlugins([
      { name: 'a', onPaste: first },
      { name: 'b', onPaste: second },
      { name: 'c', onPaste: third },
    ]);
    const data = {} as DataTransfer;
    expect(runTransfer('onPaste', data, { blockId: 'x', plain: false })).toBe(true);
    expect(first).toHaveBeenCalledWith(data, { blockId: 'x', plain: false });
    expect(second).toHaveBeenCalled();
    expect(third).not.toHaveBeenCalled();
    expect(runTransfer('onDrop', data, { blockId: 'x', plain: false })).toBe(false);
  });
});

describe('host integration (A5, A10, A11, i18n)', () => {
  it('scopes the root, hides the title, applies theme and messages', () => {
    const el = mount({
      showTitle: false,
      theme: 'dark',
      className: 'my-editor',
      messages: { placeholder: 'Type here' },
      defaultDoc: docOf([block('a', '')], ['a']),
    });
    const root = el.querySelector('.ne-root')!;
    expect(root.classList.contains('my-editor')).toBe(true);
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(el.querySelector('.page-title')).toBeNull();
    expect(el.querySelector('[data-editable-id="a"]')?.getAttribute('data-placeholder')).toBe('Type here');
  });

  it('shows block actions in the block menu and hides text-only items for non-text blocks', () => {
    const onSelect = vi.fn();
    const media: BlockSpec = {
      type: 'media',
      component: () => createElement('div', null, 'media'),
      content: 'none',
      actions: (b) => [{ id: 'replace', label: `Replace ${b.id}`, onSelect }],
    };
    const el = mount({ blocks: [media], defaultDoc: docOf([{ ...createBlock('media'), id: 'm' }], ['m']) });
    act(() => useEditor.setState({ selection: { ids: ['m'], anchor: 'm', focus: 'm' }, blockMenu: { x: 0, y: 0 } }));
    const labels = [...el.querySelectorAll('.block-menu .menu-title')].map((n) => n.textContent);
    expect(labels).toContain('Replace m');
    expect(labels).not.toContain('Turn into');
    const button = [...el.querySelectorAll<HTMLButtonElement>('.block-menu .menu-item')].find((b) =>
      b.textContent?.includes('Replace m'),
    )!;
    act(() => button.click());
    expect(onSelect).toHaveBeenCalledOnce();
    expect(useEditor.getState().blockMenu).toBeNull();
  });

  it('warns when two editors are mounted at once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    cleanup.push(() => error.mockRestore());
    mount({});
    mount({});
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Only one <Editor>'));
  });
});

describe('several menu entries for one type', () => {
  it('lists each entry with its own props; only the first is offered in Turn into', () => {
    setBlocks([
      paragraph,
      {
        type: 'view',
        component: () => null,
        content: 'none',
        props: { name: '' },
        menu: [
          { label: 'Map', icon: 'M', props: { kind: 'map' } },
          { label: 'Board', icon: 'B', props: { kind: 'board' } },
        ],
      },
    ]);
    const views = commands().filter((c) => c.type === 'view');
    expect(views.map((c) => [c.key, c.label, c.props])).toEqual([
      ['view', 'Map', { name: '', kind: 'map' }],
      ['view#1', 'Board', { name: '', kind: 'board' }],
    ]);
    expect(views.map((c) => c.turnInto)).toEqual([true, false]);
  });
});

describe('setPropsQuietly', () => {
  it('changes a block without an undo step and keeps the change through undo', () => {
    setDocument(docOf([block('a')], ['a']));
    setProps(['a'], { n: 1 });
    setPropsQuietly(['a'], { src: '/done.png' });
    expect(useEditor.getState().past).toHaveLength(1);
    undo();
    expect(useEditor.getState().doc.blocks.a.props).toEqual({ src: '/done.png' });
  });
});

describe('built-in labels follow messages', () => {
  it('reads labels and placeholders when they are used', () => {
    setBlocks(allBlocks);
    setMessages({ paragraph: 'Texte', listPlaceholder: 'Liste' });
    cleanup.push(() => setMessages());
    expect(commands().find((c) => c.type === 'paragraph')?.label).toBe('Texte');
    expect(getSpec('bullet')?.placeholder).toBe('Liste');
  });
});

describe('fragmentFromHtml', () => {
  const pic: BlockSpec = {
    type: 'pic',
    component: () => null,
    content: 'none',
    parseHtml: { tags: ['IMG'], props: (el) => ({ src: el.getAttribute('src') ?? undefined }) },
  };
  const grid: BlockSpec = {
    type: 'grid',
    component: () => null,
    content: 'none',
    parseHtml: { tags: ['TABLE'], props: (el) => ({ cells: el.querySelectorAll('td').length }) },
  };

  it('nests list items and keeps only their own text', () => {
    setBlocks(allBlocks);
    const f = fragmentFromHtml('<ul><li>one<ul><li>inner</li></ul></li><li>two</li></ul>')!;
    const [one, two] = f.rootIds.map((id) => f.blocks[id]);
    expect([one.html, two.html]).toEqual(['one', 'two']);
    expect(f.blocks[one.children[0]]).toMatchObject({ type: 'bullet', html: 'inner', parentId: one.id });
  });

  it('reads props of non-text blocks and does not parse inside them', () => {
    setBlocks([...allBlocks, pic, grid]);
    const f = fragmentFromHtml('<p>before</p><img src="/a.png"><table><tr><td><p>x</p></td><td>y</td></tr></table>')!;
    expect(f.rootIds.map((id) => [f.blocks[id].type, f.blocks[id].props])).toEqual([
      ['paragraph', {}],
      ['pic', { src: '/a.png' }],
      ['grid', { cells: 2 }],
    ]);
  });

  it('accepts a single non-text block', () => {
    setBlocks([...allBlocks, pic]);
    const f = fragmentFromHtml('<img src="/only.png">')!;
    expect(f.rootIds.map((id) => f.blocks[id].props.src)).toEqual(['/only.png']);
  });
});
