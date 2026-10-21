/** Caret helpers working in plain-text offsets within one contentEditable root. */

export function textOffsetOf(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(root, 0);
  try {
    r.setEnd(node, offset);
  } catch {
    return 0;
  }
  return r.toString().length;
}

export function positionAt(root: Node, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: Text | null = null;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const len = n.data.length;
    if (remaining <= len) return { node: n, offset: remaining };
    remaining -= len;
    last = n;
  }
  if (last) return { node: last, offset: last.data.length };
  return { node: root, offset: offset > 0 ? root.childNodes.length : 0 };
}

export function selectionIn(root: HTMLElement): Selection | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) return null;
  return sel;
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = selectionIn(root);
  if (!sel) return null;
  const r = sel.getRangeAt(0);
  return {
    start: textOffsetOf(root, r.startContainer, r.startOffset),
    end: textOffsetOf(root, r.endContainer, r.endOffset),
  };
}

export function setCaret(root: HTMLElement, where: number | 'start' | 'end') {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  if (where === 'start') {
    r.setStart(root, 0);
  } else if (where === 'end') {
    r.selectNodeContents(root);
    r.collapse(false);
  } else {
    const p = positionAt(root, where);
    r.setStart(p.node, p.offset);
  }
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function selectRange(root: HTMLElement, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const a = positionAt(root, start);
  const b = positionAt(root, end);
  sel.setBaseAndExtent(a.node, a.offset, b.node, b.offset);
}

export function isCaretAtStart(root: HTMLElement): boolean {
  const o = getSelectionOffsets(root);
  return !!o && o.start === 0 && o.end === 0;
}

export function isCaretAtEnd(root: HTMLElement): boolean {
  const o = getSelectionOffsets(root);
  const len = root.textContent?.length ?? 0;
  return !!o && o.start === len && o.end === len;
}

function rectOfRange(r: Range): DOMRect | null {
  const rects = r.getClientRects();
  if (rects.length) return rects[rects.length - 1];
  const node = r.startContainer;
  const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
  if (!el) return null;
  const child = node.nodeType === Node.ELEMENT_NODE ? (node.childNodes[r.startOffset] as HTMLElement | undefined) : undefined;
  const target = child && child.nodeType === Node.ELEMENT_NODE ? child : el;
  const b = target.getBoundingClientRect();
  return b.height ? b : null;
}

export function caretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(sel.focusNode === r.endContainer && sel.focusOffset === r.endOffset ? false : true);
  return rectOfRange(r);
}

function edgeRect(root: HTMLElement, edge: 'start' | 'end'): DOMRect | null {
  const r = document.createRange();
  r.selectNodeContents(root);
  r.collapse(edge === 'start');
  return rectOfRange(r);
}

function lineHeight(root: HTMLElement) {
  return parseFloat(getComputedStyle(root).lineHeight) || 24;
}

export function isOnFirstLine(root: HTMLElement): boolean {
  if (!root.textContent) return true;
  const c = caretRect();
  const s = edgeRect(root, 'start');
  if (!c || !s) return true;
  return c.top < s.top + lineHeight(root) * 0.6;
}

export function isOnLastLine(root: HTMLElement): boolean {
  if (!root.textContent) return true;
  const c = caretRect();
  const e = edgeRect(root, 'end');
  if (!c || !e) return true;
  return c.bottom > e.bottom - lineHeight(root) * 0.6;
}

type DocWithCaret = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

export function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as DocWithCaret;
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = document.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}

/** Put the caret on the first/last line of `root` as close to `x` as possible. */
export function placeCaretAtX(root: HTMLElement, x: number, line: 'first' | 'last') {
  const box = root.getBoundingClientRect();
  const lh = lineHeight(root);
  const y = line === 'first' ? box.top + lh / 2 : box.bottom - lh / 2;
  const clampedX = Math.min(Math.max(x, box.left + 1), box.right - 1);
  const p = caretFromPoint(clampedX, y);
  if (p && root.contains(p.node)) {
    const sel = window.getSelection();
    sel?.setBaseAndExtent(p.node, p.offset, p.node, p.offset);
  } else {
    setCaret(root, line === 'first' ? 'start' : 'end');
  }
}
