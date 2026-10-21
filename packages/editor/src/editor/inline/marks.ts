import { selectionIn } from './caret';

export type Mark = 'bold' | 'italic' | 'underline' | 'strike' | 'code';

const EXEC: Partial<Record<Mark, string>> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  strike: 'strikeThrough',
};

function closestTag(node: Node | null, selector: string, root: HTMLElement): HTMLElement | null {
  let el = (node && node.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement) as HTMLElement | null;
  while (el && el !== root) {
    if (el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

function unwrap(el: HTMLElement) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function wrapRange(range: Range, el: HTMLElement, removeSelector: string) {
  const frag = range.extractContents();
  frag.querySelectorAll(removeSelector).forEach((n) => unwrap(n as HTMLElement));
  el.appendChild(frag);
  range.insertNode(el);
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(r);
}

export function toggleMark(root: HTMLElement, mark: Mark) {
  const sel = selectionIn(root);
  if (!sel) return;
  const cmd = EXEC[mark];
  if (cmd) {
    // With a collapsed caret this toggles the style for the next typed characters.
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(cmd);
    return;
  }
  if (sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const existing = closestTag(range.commonAncestorContainer, 'code', root);
  if (existing) unwrap(existing);
  else wrapRange(range, document.createElement('code'), 'code');
}

export function isMarkActive(root: HTMLElement, mark: Mark): boolean {
  const sel = selectionIn(root);
  if (!sel || !sel.rangeCount) return false;
  const selector = { bold: 'b,strong', italic: 'i,em', underline: 'u', strike: 's,strike,del', code: 'code' }[mark];
  return !!closestTag(sel.getRangeAt(0).commonAncestorContainer, selector, root);
}

/** Apply a text color token ("red", "blue_bg", …) or clear it with "default". */
export function setColor(root: HTMLElement, color: string) {
  const sel = selectionIn(root);
  if (!sel || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const existing = closestTag(range.commonAncestorContainer, 'span[data-color]', root);
  if (existing && existing.textContent === range.toString()) {
    if (color === 'default') unwrap(existing);
    else existing.setAttribute('data-color', color);
    return;
  }
  if (color === 'default') {
    const frag = range.extractContents();
    frag.querySelectorAll('span[data-color]').forEach((n) => unwrap(n as HTMLElement));
    range.insertNode(frag);
    return;
  }
  const span = document.createElement('span');
  span.setAttribute('data-color', color);
  wrapRange(range, span, 'span[data-color]');
}

/** Links that contain or intersect the current selection. */
function linksInSelection(root: HTMLElement): HTMLAnchorElement[] {
  const sel = selectionIn(root);
  if (!sel || !sel.rangeCount) return [];
  const range = sel.getRangeAt(0);
  const found = new Set<HTMLAnchorElement>();
  const around = closestTag(range.commonAncestorContainer, 'a', root);
  if (around) found.add(around as HTMLAnchorElement);
  root.querySelectorAll('a').forEach((a) => {
    if (range.intersectsNode(a)) found.add(a);
  });
  return [...found];
}

export function setLink(root: HTMLElement, href: string | null) {
  const sel = selectionIn(root);
  if (!sel) return;
  const links = linksInSelection(root);
  if (!href) {
    links.forEach(unwrap);
    return;
  }
  if (!sel.isCollapsed) {
    document.execCommand('createLink', false, href);
  } else if (links.length) {
    // Caret inside a link: edit that link's address.
    links.forEach((a) => a.setAttribute('href', href));
  }
}

export function linkAtSelection(root: HTMLElement): HTMLAnchorElement | null {
  return linksInSelection(root)[0] ?? null;
}
