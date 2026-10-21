import type { Block, BlockType, Doc } from './types';
import { createBlock } from './tree';

/** Shape check for a document loaded from storage or the network. */
export function isDoc(v: unknown): v is Doc {
  if (!v || typeof v !== 'object') return false;
  const d = v as Doc;
  if (!Array.isArray(d.rootIds) || !d.blocks || typeof d.blocks !== 'object') return false;
  return d.rootIds.every((id) => d.blocks[id] && Array.isArray(d.blocks[id].children));
}

type Seed = [BlockType, string, Block['props']?, Seed[]?];

function build(seeds: Seed[]): Doc {
  const blocks: Record<string, Block> = {};
  const make = (s: Seed, parentId: string | null): string => {
    const b = createBlock(s[0], s[1], s[2]);
    b.parentId = parentId;
    blocks[b.id] = b;
    b.children = (s[3] ?? []).map((c) => make(c, b.id));
    return b.id;
  };
  return { title: 'Welcome to the block editor', blocks, rootIds: seeds.map((s) => make(s, null)) };
}

export function sampleDoc(): Doc {
  return build([
    ['callout', 'A block editor built from scratch. Try <b>dragging in the page margin</b> to select blocks.', { icon: '💡' }],
    ['h2', 'Basics'],
    ['bullet', 'Type <code>/</code> to open the command menu'],
    ['bullet', 'Type <code>#</code>, <code>-</code>, <code>1.</code>, <code>[]</code> or <code>&gt;</code> plus a space to change the block type'],
    ['bullet', '<b>Tab</b> / <b>Shift+Tab</b> to indent', {}, [
      ['bullet', 'Nested item'],
      ['bullet', 'One more level', {}, [['bullet', 'Even deeper']]],
    ]],
    ['h2', 'Selection'],
    ['numbered', 'Drag a text selection from one block into another to switch to <span data-color="blue">block selection</span>'],
    ['numbered', 'Press <b>Esc</b> while editing to select the block, then <b>Shift+↑/↓</b> to extend'],
    ['numbered', 'With blocks selected: <b>Backspace</b> deletes, <b>Ctrl+C / X / V</b>, <b>Ctrl+D</b> duplicates, drag ⋮⋮ to move'],
    ['todo', 'On touch devices: tap ⋮⋮ for the menu, long-press ⋮⋮ to drag', { checked: false }],
    ['todo', 'No marquee selection on touch', { checked: true }],
    ['toggle', 'Open me', { open: false }, [['paragraph', 'Content inside the toggle']]],
    ['quote', 'Simplicity is prerequisite for reliability. — Edsger W. Dijkstra'],
    ['divider', ''],
    ['code', 'function hello() {\n  return "world";\n}'],
    ['paragraph', ''],
  ]);
}
