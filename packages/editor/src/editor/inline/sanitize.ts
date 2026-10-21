import { inlineSpans } from './spans';

const TAG_MAP: Record<string, string> = {
  B: 'b',
  STRONG: 'b',
  I: 'i',
  EM: 'i',
  U: 'u',
  S: 's',
  STRIKE: 's',
  DEL: 's',
  CODE: 'code',
  A: 'a',
  SPAN: 'span',
  BR: 'br',
};

const SAFE_URL = /^(https?:|mailto:|#|\/)/i;

function escapeText(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string) {
  return escapeText(s).replace(/"/g, '&quot;');
}

function walk(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  if (/^(SCRIPT|STYLE|META|TITLE|HEAD)$/.test(el.tagName)) return '';
  const inner = Array.from(el.childNodes).map(walk).join('');
  const tag = TAG_MAP[el.tagName];
  if (tag === 'br') return '<br>';
  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    return SAFE_URL.test(href) ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
  }
  if (tag === 'span') {
    const kind = inlineSpans().find((s) => {
      const v = el.getAttribute(s.attr);
      return v !== null && (!s.valid || s.valid(v));
    });
    if (!kind) return inner;
    const attrs = [kind.attr, ...(kind.keep ?? [])]
      .filter((a) => el.hasAttribute(a))
      .map((a) => ` ${a}="${escapeAttr(el.getAttribute(a)!)}"`)
      .join('');
    if (kind.atomic) return `<span${attrs} contenteditable="false">${escapeText(el.textContent ?? '')}</span>`;
    return inner ? `<span${attrs}>${inner}</span>` : '';
  }
  if (tag) return inner ? `<${tag}>${inner}</${tag}>` : '';
  // Inline-styled spans from other editors (e.g. Google Docs)
  const style = el.style;
  let out = inner;
  if (style && inner) {
    if (style.fontWeight === 'bold' || Number(style.fontWeight) >= 600) out = `<b>${out}</b>`;
    if (style.fontStyle === 'italic') out = `<i>${out}</i>`;
  }
  // Block-level elements collapse to line breaks inside a single block.
  if (/^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE|TR)$/.test(el.tagName) && el.nextSibling) out += '<br>';
  return out;
}

/** Reduce arbitrary HTML to the inline whitelist used by blocks. */
export function sanitizeInline(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return Array.from(tpl.content.childNodes).map(walk).join('').replace(/(<br>)+$/, '');
}

export function textToHtml(text: string): string {
  return escapeText(text).replace(/\n/g, '<br>');
}

export function htmlToText(html: string): string {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.replace(/<br\s*\/?>/gi, '\n');
  return tpl.content.textContent ?? '';
}

/** A contentEditable that only holds a stray <br> is empty. */
export function normalizeEmpty(html: string): string {
  return html === '<br>' || html === '<br/>' ? '' : html;
}
