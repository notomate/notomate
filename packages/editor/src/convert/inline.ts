import type { TipTapMark, TipTapNode } from './types';

/**
 * Inline content ↔ the editor's whitelisted inline HTML, without a DOM so it also
 * runs in Node (the collab server).
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Outermost first, so the same marks always nest the same way. */
const MARK_ORDER = ['link', 'comment', 'textColor', 'bold', 'italic', 'underline', 'strike', 'code'];
const rank = (m: TipTapMark) => {
  const i = MARK_ORDER.indexOf(m.type);
  return i < 0 ? MARK_ORDER.length : i;
};

function open(m: TipTapMark): string {
  switch (m.type) {
    case 'bold':
      return '<b>';
    case 'italic':
      return '<i>';
    case 'underline':
      return '<u>';
    case 'strike':
      return '<s>';
    case 'code':
      return '<code>';
    case 'link':
      return `<a href="${escapeAttr(String(m.attrs?.href ?? ''))}">`;
    case 'comment':
      return `<span data-comment-thread-id="${escapeAttr(String(m.attrs?.threadId ?? ''))}">`;
    case 'textColor':
      return `<span data-color="${escapeAttr(String(m.attrs?.color ?? ''))}">`;
    default:
      return '';
  }
}

function close(m: TipTapMark): string {
  switch (m.type) {
    case 'bold':
      return '</b>';
    case 'italic':
      return '</i>';
    case 'underline':
      return '</u>';
    case 'strike':
      return '</s>';
    case 'code':
      return '</code>';
    case 'link':
      return '</a>';
    case 'comment':
    case 'textColor':
      return '</span>';
    default:
      return '';
  }
}

/** Inline TipTap nodes (text, hardBreak, mention) → inline HTML. Unknown marks are dropped. */
export function inlineToHtml(nodes: readonly TipTapNode[] | undefined): string {
  if (!nodes) return '';
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      if (!n.text) continue;
      const marks = [...(n.marks ?? [])].filter((m) => open(m)).sort((a, b) => rank(a) - rank(b));
      out += marks.map(open).join('') + escapeText(n.text) + [...marks].reverse().map(close).join('');
    } else if (n.type === 'hardBreak') {
      out += '<br>';
    } else if (n.type === 'mention') {
      const id = String(n.attrs?.id ?? '');
      const label = String(n.attrs?.label ?? id);
      const char = String(n.attrs?.mentionSuggestionChar ?? '@');
      out +=
        `<span data-mention="" data-id="${escapeAttr(id)}" data-label="${escapeAttr(label)}"` +
        ` data-char="${escapeAttr(char)}" contenteditable="false">${escapeText(char + label)}</span>`;
    } else if (n.content) {
      out += inlineToHtml(n.content);
    } else if (n.text) {
      out += escapeText(n.text);
    }
  }
  return out;
}

function parseAttrs(src: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (let m; (m = re.exec(src)); ) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}

const SIMPLE: Record<string, TipTapMark['type']> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  s: 'strike',
  strike: 'strike',
  del: 'strike',
  code: 'code',
};

const SAFE_URL = /^(https?:|mailto:|#|\/)/i;

function markFor(tag: string, attrs: Record<string, string>): TipTapMark | null {
  if (SIMPLE[tag]) return { type: SIMPLE[tag] };
  if (tag === 'a') return SAFE_URL.test(attrs.href ?? '') ? { type: 'link', attrs: { href: attrs.href } } : null;
  if (tag === 'span') {
    if (attrs['data-comment-thread-id']) return { type: 'comment', attrs: { threadId: attrs['data-comment-thread-id'] } };
    if (attrs['data-color'] && /^[a-z_]+$/.test(attrs['data-color'])) {
      return { type: 'textColor', attrs: { color: attrs['data-color'] } };
    }
  }
  return null;
}

const sameMarks = (a: TipTapMark[] = [], b: TipTapMark[] = []) => JSON.stringify(a) === JSON.stringify(b);

/** Inline HTML → TipTap inline nodes. Tags outside the whitelist are unwrapped. */
export function htmlToInline(html: string): TipTapNode[] {
  const out: TipTapNode[] = [];
  const stack: { tag: string; mark: TipTapMark | null }[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const marks = stack
      .map((s) => s.mark)
      .filter((m): m is TipTapMark => !!m)
      .sort((a, b) => rank(a) - rank(b));
    const last = out[out.length - 1];
    if (last?.type === 'text' && sameMarks(last.marks, marks.length ? marks : undefined)) {
      last.text += text;
      return;
    }
    out.push(marks.length ? { type: 'text', text, marks } : { type: 'text', text });
  };

  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|(<)/g;
  for (let m; (m = re.exec(html)); ) {
    if (m[4] !== undefined || m[5] !== undefined) {
      pushText(decodeEntities(m[4] ?? m[5]));
      continue;
    }
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'br') {
      if (!closing) out.push({ type: 'hardBreak' });
      continue;
    }
    if (closing) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    const attrs = parseAttrs(m[3]);
    if (tag === 'span' && 'data-mention' in attrs) {
      // A mention is atomic: skip its rendered label up to the matching </span>.
      const end = html.indexOf('</span>', re.lastIndex);
      re.lastIndex = end < 0 ? html.length : end + '</span>'.length;
      out.push({
        type: 'mention',
        attrs: {
          id: attrs['data-id'] ?? null,
          label: attrs['data-label'] ?? null,
          mentionSuggestionChar: attrs['data-char'] || '@',
        },
      });
      continue;
    }
    if (/\/\s*$/.test(m[3])) continue;
    stack.push({ tag, mark: markFor(tag, attrs) });
  }
  return out;
}

/** Plain text of inline HTML (`<br>` becomes a newline). */
export function htmlToPlain(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
}
