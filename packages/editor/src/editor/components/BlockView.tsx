import { memo, type ReactNode } from 'react';
import { commit, useEditor } from '../model/store';
import { addAfter, createBlock, insertAt } from '../model/tree';
import type { Block } from '../model/types';
import { getSpec, isCollapsed } from '../blocks/registry';
import { TextBlock } from './BlockText';
import { getPlugins } from '../plugins';
import { onHandlePointerDown } from '../dnd/useBlockDrag';
import { insertBlockAfter } from '../ops';
import { msg } from '../messages';

function addFirstChild(parentId: string) {
  const b = createBlock();
  commit((d) => {
    d.blocks[b.id] = b;
    insertAt(d, b.id, parentId, 0);
  }, { focus: { id: b.id, at: 'start' } });
}

/** "+" in the gutter: new block below with the slash menu open, like Notion. */
function addBelowWithSlash(id: string) {
  const b = createBlock('paragraph', '/');
  commit((d) => addAfter(d, b, id), { focus: { id: b.id, at: 'end' } });
  useEditor.setState({ slash: { blockId: b.id, from: 0, query: '', index: 0 } });
}

function Content({ block, depth }: { block: Block; depth: number }) {
  const C = getSpec(block.type)?.component ?? TextBlock;
  return <C block={block} depth={depth} />;
}

export const BlockView = memo(function BlockView({ id, depth }: { id: string; depth: number }) {
  const block = useEditor((s) => s.doc.blocks[id]);
  const selected = useEditor((s) => s.selection.ids.includes(id));
  const focused = useEditor((s) => s.focusedId === id);
  if (!block) return null;
  const collapsible = !!getSpec(block.type)?.collapsible;
  const showChildren = !isCollapsed(block);
  const color = block.props.color;
  let children: ReactNode = null;
  if (showChildren && block.children.length) {
    children = (
      <div className="block-children">
        {block.children.map((c) => (
          <BlockView key={c} id={c} depth={depth + 1} />
        ))}
      </div>
    );
  } else if (collapsible && showChildren) {
    children = (
      <div className="block-children">
        <button type="button" className="toggle-empty" onClick={() => addFirstChild(id)}>
          {msg().emptyToggle}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        'block',
        `type-${block.type}`,
        selected && 'selected',
        focused && 'focused',
        color && (color.endsWith('_bg') ? `bg-${color.slice(0, -3)}` : `color-${color}`),
      ]
        .filter(Boolean)
        .join(' ')}
      data-block-id={id}
    >
      {getPlugins().map((p) => {
        const D = p.decorations?.block;
        return D && <D key={p.name} blockId={id} />;
      })}
      <div className="block-row">
        {getPlugins().map((p) => {
          const D = p.decorations?.row;
          return D && <D key={p.name} blockId={id} />;
        })}
        <div className="gutter" contentEditable={false}>
          <button
            type="button"
            className="gutter-btn add"
            aria-label={msg().addBelow}
            onClick={(e) => (e.altKey ? insertBlockAfter(id) : addBelowWithSlash(id))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M7.25 2.5h1.5v4.75h4.75v1.5H8.75v4.75h-1.5V8.75H2.5v-1.5h4.75z" fill="currentColor" />
            </svg>
          </button>
          <div
            className="gutter-btn handle"
            role="button"
            tabIndex={-1}
            aria-label={msg().dragHandle}
            onPointerDown={(e) => onHandlePointerDown(e, id)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 10 16" aria-hidden="true">
              {[3, 8, 13].map((y) => (
                <g key={y}>
                  <circle cx="2.5" cy={y} r="1.4" fill="currentColor" />
                  <circle cx="7.5" cy={y} r="1.4" fill="currentColor" />
                </g>
              ))}
            </svg>
          </div>
        </div>
        <div className="block-content">
          <Content block={block} depth={depth} />
        </div>
      </div>
      {children}
    </div>
  );
});
