import type { Block, BlockProps, Doc } from '../editor/model/types';
import type { TableCell, TipTapNode } from './types';
import { escapeText, htmlToInline, htmlToPlain, inlineToHtml } from './inline';

export type { TableCell, TipTapMark, TipTapNode } from './types';
export { htmlToInline, htmlToPlain, inlineToHtml } from './inline';
export { repairOrphans } from '../editor/model/repair';

/**
 * TipTap (ProseMirror) JSON ↔ editor `Doc`. Notes are stored as TipTap JSON, so
 * the web editor and the collab server convert at the boundary. Pure functions,
 * no DOM: safe to run in Node.
 */

const LISTS: Record<string, { item: string; type: string }> = {
  bulletList: { item: 'listItem', type: 'bullet' },
  orderedList: { item: 'listItem', type: 'numbered' },
  taskList: { item: 'taskItem', type: 'todo' },
};

const DEFAULT_CELL_ATTRS = { colspan: 1, rowspan: 1, colwidth: null };

let counter = 0;
const newId = () => Math.random().toString(36).slice(2, 10) + (counter++).toString(36);

export const EMPTY_TIPTAP: TipTapNode = { type: 'doc', content: [{ type: 'paragraph' }] };

/** Drop empty text nodes, which ProseMirror rejects. */
function sanitize(node: TipTapNode): TipTapNode | null {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'text') return node.text ? node : null;
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map(sanitize).filter((n): n is TipTapNode => !!n) };
  }
  return node;
}

/**
 * Parse a stored note body. Recovers the first complete JSON object from
 * duplicated or truncated content; `error` is true when nothing could be read.
 */
export function parseTiptap(content: string | null | undefined): { doc: TipTapNode; error: boolean } {
  if (!content) return { doc: EMPTY_TIPTAP, error: false };
  const accept = (v: unknown) => {
    const n = sanitize(v as TipTapNode);
    return n && n.type === 'doc' ? n : EMPTY_TIPTAP;
  };
  try {
    return { doc: accept(JSON.parse(content)), error: false };
  } catch {
    const start = content.indexOf('{');
    let depth = 0;
    if (start !== -1) {
      for (let i = start; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}' && --depth === 0) {
          try {
            return { doc: accept(JSON.parse(content.slice(start, i + 1))), error: false };
          } catch {
            break;
          }
        }
      }
    }
    return { doc: EMPTY_TIPTAP, error: true };
  }
}

// ---------------------------------------------------------------- TipTap → Doc

export function tiptapToDoc(json: TipTapNode, title = ''): Doc {
  const blocks: Record<string, Block> = {};

  const add = (type: string, html: string, props: BlockProps, parentId: string | null): Block => {
    const b: Block = { id: newId(), type, html, props, children: [], parentId };
    blocks[b.id] = b;
    return b;
  };

  /** First paragraph becomes the block's text, the rest its children (list items, quotes). */
  const container = (type: string, props: BlockProps, content: TipTapNode[] = [], parentId: string | null) => {
    const [first, ...rest] = content;
    const b = add(type, first?.type === 'paragraph' ? inlineToHtml(first.content) : '', props, parentId);
    b.children = walk(first?.type === 'paragraph' ? rest : content, b.id);
    return b.id;
  };

  const walk = (nodes: TipTapNode[] = [], parentId: string | null): string[] => {
    const ids: string[] = [];
    for (const n of nodes) {
      const list = LISTS[n.type];
      if (list) {
        (n.content ?? []).forEach((item, i) => {
          const props: BlockProps = {};
          if (list.type === 'todo') props.checked = !!item.attrs?.checked;
          if (list.type === 'numbered' && i === 0 && typeof n.attrs?.start === 'number' && n.attrs.start !== 1) {
            props.start = n.attrs.start;
          }
          ids.push(container(list.type, props, item.content, parentId));
        });
        continue;
      }
      switch (n.type) {
        case 'paragraph':
          ids.push(add('paragraph', inlineToHtml(n.content), {}, parentId).id);
          break;
        case 'heading': {
          const level = Math.min(6, Math.max(1, Number(n.attrs?.level) || 1));
          ids.push(add(`h${level}`, inlineToHtml(n.content), {}, parentId).id);
          break;
        }
        case 'blockquote':
          ids.push(container('quote', {}, n.content, parentId));
          break;
        case 'codeBlock': {
          const text = (n.content ?? []).map((t) => t.text ?? '').join('');
          ids.push(add('code', escapeText(text), { language: n.attrs?.language ?? null }, parentId).id);
          break;
        }
        case 'horizontalRule':
          ids.push(add('divider', '', {}, parentId).id);
          break;
        case 'table': {
          const rows: TableCell[][] = (n.content ?? []).map((row) =>
            (row.content ?? []).map((cell) => ({
              html: (cell.content ?? []).map((p) => inlineToHtml(p.content)).join('<br>'),
              header: cell.type === 'tableHeader',
              attrs: { ...DEFAULT_CELL_ATTRS, ...cell.attrs },
            })),
          );
          ids.push(add('table', '', { rows }, parentId).id);
          break;
        }
        case 'text':
        case 'hardBreak':
        case 'mention':
          // Stray inline content at block level: wrap it like ProseMirror would.
          ids.push(add('paragraph', inlineToHtml([n]), {}, parentId).id);
          break;
        default: {
          // Custom atom nodes (image, embeds, maps…): attrs become props verbatim.
          const props: BlockProps = { ...n.attrs };
          if (n.content?.length) props._content = n.content;
          ids.push(add(n.type, '', props, parentId).id);
        }
      }
    }
    return ids;
  };

  const rootIds = walk(json?.content, null);
  if (!rootIds.length) rootIds.push(add('paragraph', '', {}, null).id);
  return { title, blocks, rootIds };
}

// ---------------------------------------------------------------- Doc → TipTap

const LIST_OF: Record<string, { list: string; item: string }> = {
  bullet: { list: 'bulletList', item: 'listItem' },
  numbered: { list: 'orderedList', item: 'listItem' },
  todo: { list: 'taskList', item: 'taskItem' },
};

const paragraph = (html: string): TipTapNode => {
  const content = htmlToInline(html);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
};

export function docToTiptap(doc: Doc): TipTapNode {
  const convert = (ids: string[]): TipTapNode[] => {
    const out: TipTapNode[] = [];
    let i = 0;
    while (i < ids.length) {
      const b = doc.blocks[ids[i]];
      if (!b) {
        i++;
        continue;
      }
      const list = LIST_OF[b.type];
      if (list) {
        // Consecutive siblings of one list type form a single list node.
        const items: TipTapNode[] = [];
        const first = b;
        for (; i < ids.length && doc.blocks[ids[i]]?.type === b.type; i++) {
          const item = doc.blocks[ids[i]];
          const node: TipTapNode = { type: list.item, content: [paragraph(item.html), ...convert(item.children)] };
          if (b.type === 'todo') node.attrs = { checked: !!item.props.checked };
          items.push(node);
        }
        const node: TipTapNode = { type: list.list, content: items };
        if (b.type === 'numbered') node.attrs = { start: typeof first.props.start === 'number' ? first.props.start : 1, type: null };
        out.push(node);
        continue;
      }
      i++;
      out.push(...block(b));
    }
    return out;
  };

  /** One block; paragraphs and headings cannot nest in TipTap, so their children follow them. */
  const block = (b: Block): TipTapNode[] => {
    const heading = /^h([1-6])$/.exec(b.type);
    if (heading) {
      const content = htmlToInline(b.html);
      const node: TipTapNode = { type: 'heading', attrs: { level: Number(heading[1]) } };
      if (content.length) node.content = content;
      return [node, ...convert(b.children)];
    }
    switch (b.type) {
      case 'paragraph':
        return [paragraph(b.html), ...convert(b.children)];
      case 'quote':
        return [{ type: 'blockquote', content: [paragraph(b.html), ...convert(b.children)] }];
      case 'code': {
        const text = htmlToPlain(b.html);
        const node: TipTapNode = { type: 'codeBlock', attrs: { language: b.props.language ?? null } };
        if (text) node.content = [{ type: 'text', text }];
        return [node];
      }
      case 'divider':
        return [{ type: 'horizontalRule' }];
      case 'table': {
        const rows = (b.props.rows as TableCell[][] | undefined) ?? [];
        return [
          {
            type: 'table',
            content: rows.map((row) => ({
              type: 'tableRow',
              content: row.map((cell) => ({
                type: cell.header ? 'tableHeader' : 'tableCell',
                attrs: { ...DEFAULT_CELL_ATTRS, ...cell.attrs },
                content: (cell.html ? cell.html.split(/<br\s*\/?>/i) : ['']).map(paragraph),
              })),
            })),
          },
        ];
      }
      default: {
        const { _content, ...attrs } = b.props;
        const node: TipTapNode = { type: b.type, attrs };
        if (Array.isArray(_content)) node.content = _content as TipTapNode[];
        else if (b.html) node.content = [paragraph(b.html)];
        return [node, ...convert(b.children)];
      }
    }
  };

  const content = convert(doc.rootIds);
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
