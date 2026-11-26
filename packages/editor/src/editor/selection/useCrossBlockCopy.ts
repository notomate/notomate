import { useEffect } from 'react';
import { useEditor } from '../model/store';
import type { Block } from '../model/types';
import type { Fragment } from '../ops';
import { writeFragment } from '../clipboard';
import { blockIdOfRow, rowsIn } from '../input/pointer';
import { textOffsetOf } from '../inline/caret';
import { splitHtmlAt } from '../inline/splitHtml';

/**
 * The blocks a text selection runs across, as a fragment. The first and last blocks
 * keep only their selected text; blocks are nested as in the document, among the
 * selected ones. Null when the selection stays inside one block.
 */
export function fragmentOfRange(range: Range, root: ParentNode = document): Fragment | null {
  const ids = rowsIn(root)
    .filter((r) => range.intersectsNode(r))
    .map(blockIdOfRow);
  if (ids.length < 2) return null;
  const doc = useEditor.getState().doc;
  const picked = new Set(ids);
  const blocks: Record<string, Block> = {};
  for (const id of ids) {
    const b = doc.blocks[id];
    if (b) blocks[id] = { ...b, props: { ...b.props }, children: b.children.filter((c) => picked.has(c)) };
  }
  const trim = (node: Node, offset: number, keep: 'after' | 'before') => {
    const el = (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)?.closest<HTMLElement>(
      '[data-editable-id]',
    );
    const b = el && blocks[el.dataset.editableId!];
    if (!b) return;
    const [before, after] = splitHtmlAt(b.html, textOffsetOf(el, node, offset));
    b.html = keep === 'after' ? after : before;
  };
  trim(range.startContainer, range.startOffset, 'after');
  trim(range.endContainer, range.endOffset, 'before');
  const nested = new Set(Object.values(blocks).flatMap((b) => b.children));
  return { blocks, rootIds: ids.filter((id) => blocks[id] && !nested.has(id)) };
}

/**
 * Copying a native text selection that spans blocks (touch: long-press, then drag the
 * handles across lines) puts the blocks on the clipboard, like a block selection does.
 */
export function useCrossBlockCopy() {
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      const sel = window.getSelection();
      if (e.defaultPrevented || !e.clipboardData || !sel?.rangeCount || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const host = (common instanceof Element ? common : common.parentElement)?.closest('.ne-root');
      if (!host) return;
      const frag = fragmentOfRange(range, host);
      if (!frag) return;
      e.preventDefault();
      writeFragment(e.clipboardData, frag);
    };
    document.addEventListener('copy', onCopy);
    return () => document.removeEventListener('copy', onCopy);
  }, []);
}
