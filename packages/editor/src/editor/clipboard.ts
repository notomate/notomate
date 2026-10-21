import type { Block } from './model/types';
import { createBlock } from './model/tree';
import { canHaveChildren } from './model/types';
import { allSpecs, contentOf, getSpec, hasBlock } from './blocks/registry';
import type { Fragment } from './ops';
import { htmlToText, sanitizeInline, textToHtml } from './inline/sanitize';
import { parseLine } from './markdownShortcuts';

export const MIME = 'application/x-notion-clone';
const MARK = /<!--notion-clone:([A-Za-z0-9+/=]+)-->/;

const encode = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

function toMarkdown(frag: Fragment): string {
  const lines: string[] = [];
  const walk = (ids: string[], depth: number) => {
    let n = 0;
    let prevType = '';
    for (const id of ids) {
      const b = frag.blocks[id];
      const text = htmlToText(b.html);
      n = b.type === prevType ? n + 1 : 1;
      prevType = b.type;
      const md = getSpec(b.type)?.toMarkdown;
      lines.push('  '.repeat(depth) + (md ? md(b, text, n) : text));
      walk(b.children, depth + 1);
    }
  };
  walk(frag.rootIds, 0);
  return lines.join('\n');
}

function toHtml(frag: Fragment): string {
  const walk = (ids: string[]): string =>
    ids
      .map((id) => {
        const b = frag.blocks[id];
        const kids = b.children.length ? `<div style="margin-left:24px">${walk(b.children)}</div>` : '';
        const html = getSpec(b.type)?.toHtml;
        return (html ? html(b) : `<p>${b.html}</p>`) + kids;
      })
      .join('');
  return walk(frag.rootIds);
}

export function writeFragment(data: DataTransfer, frag: Fragment) {
  const json = JSON.stringify(frag);
  data.setData('text/plain', toMarkdown(frag));
  data.setData('text/html', `<!--notion-clone:${encode(json)}-->${toHtml(frag)}`);
  try {
    data.setData(MIME, json);
  } catch {
    /* custom types unsupported */
  }
}

function isFragment(v: unknown): v is Fragment {
  const f = v as Fragment;
  return !!f && Array.isArray(f.rootIds) && !!f.blocks && f.rootIds.every((id) => !!f.blocks[id]);
}

/** Blocks copied from this editor, if present. */
export function readFragment(data: DataTransfer): Fragment | null {
  try {
    const raw = data.getData(MIME) || (data.getData('text/html').match(MARK)?.[1] ? decode(data.getData('text/html').match(MARK)![1]) : '');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isFragment(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Turn multi-line plain text into blocks, honouring simple Markdown and indentation. */
export function fragmentFromText(text: string): Fragment {
  const blocks: Record<string, Block> = {};
  const rootIds: string[] = [];
  const stack: { indent: number; id: string }[] = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (hasBlock('code') && /^\s*```/.test(raw)) {
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
      const b = createBlock('code', textToHtml(body.join('\n')));
      blocks[b.id] = b;
      rootIds.push(b.id);
      stack.length = 0;
      continue;
    }
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, '  ').length;
    const { type, text: t, props } = parseLine(raw.trimStart());
    const b = createBlock(type, textToHtml(t), props);
    blocks[b.id] = b;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent && canHaveChildren(blocks[parent.id])) {
      b.parentId = parent.id;
      blocks[parent.id].children.push(b.id);
    } else {
      rootIds.push(b.id);
    }
    stack.push({ indent, id: b.id });
  }
  return { blocks, rootIds };
}

function specForElement(el: Element) {
  return allSpecs().find((s) => {
    const p = s.parseHtml;
    return p && p.tags.includes(el.tagName) && (!p.match || p.match(el));
  });
}

/** Pasted HTML from elsewhere: one block per block-level element. */
export function fragmentFromHtml(html: string): Fragment | null {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const tags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote', 'pre', 'hr']);
  for (const s of allSpecs()) for (const t of s.parseHtml?.tags ?? []) tags.add(t.toLowerCase());
  const blockEls = tpl.content.querySelectorAll([...tags, 'div:not(:has(p,div,li,h1,h2,h3))'].join(','));
  if (blockEls.length < 2 && !(blockEls[0] && specForElement(blockEls[0])?.content === 'none')) return null;
  const blocks: Record<string, Block> = {};
  const rootIds: string[] = [];
  const blockOf = new Map<Element, Block>();
  /** Non-text blocks (images, tables…) own everything inside them. */
  const atoms: Element[] = [];
  blockEls.forEach((el) => {
    if (atoms.some((a) => a.contains(el))) return;
    const li = el.closest('li');
    if (li && li !== el && !(el.tagName === 'UL' || el.tagName === 'OL')) {
      // Text inside a list item belongs to that item, unless it is a non-text block of its own.
      if (specForElement(el)?.content !== 'none') return;
    }
    const spec = specForElement(el);
    const type = spec?.type ?? 'paragraph';
    const content = contentOf(type);
    if (content === 'none') atoms.push(el);
    const source = el.tagName === 'LI' ? itemText(el) : el;
    const inner =
      content === 'none' ? '' : content === 'plain' ? textToHtml(source.textContent ?? '') : sanitizeInline(source.innerHTML);
    if (content !== 'none' && !inner.trim()) return;
    const b = createBlock(type, inner, { ...getSpec(type)?.props, ...spec?.parseHtml?.props?.(el) });
    blocks[b.id] = b;
    blockOf.set(el, b);
    // Nested list items become children of the item around them.
    const parent = el.parentElement?.closest('li');
    const parentBlock = parent && blockOf.get(parent);
    if (parentBlock && canHaveChildren(parentBlock)) {
      b.parentId = parentBlock.id;
      parentBlock.children.push(b.id);
    } else {
      rootIds.push(b.id);
    }
  });
  return rootIds.length ? { blocks, rootIds } : null;
}

/** A list item without its nested lists, so their text is not repeated in the item. */
function itemText(li: Element): Element {
  const copy = li.cloneNode(true) as Element;
  copy.querySelectorAll('ul, ol').forEach((n) => n.remove());
  // A loose list wraps item text in <p>; unwrap so it stays inline.
  copy.querySelectorAll('p').forEach((p) => p.replaceWith(...Array.from(p.childNodes), document.createElement('br')));
  return copy;
}
