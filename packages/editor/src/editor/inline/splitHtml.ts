import { positionAt } from './caret';
import { normalizeEmpty } from './sanitize';

function container(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

function serialize(frag: DocumentFragment): string {
  const div = document.createElement('div');
  div.appendChild(frag);
  // Remove inline wrappers left empty by the cut.
  div.querySelectorAll('b,i,u,s,strike,code,a,span').forEach((el) => {
    if (!el.textContent && !el.querySelector('br')) el.remove();
  });
  return normalizeEmpty(div.innerHTML);
}

/**
 * Split inline HTML at text offsets. Text between `start` and `end` is dropped,
 * formatting on both sides is preserved.
 */
export function splitHtmlAt(html: string, start: number, end = start): [string, string] {
  const root = container(html);
  const a = positionAt(root, start);
  const b = positionAt(root, end);
  const before = document.createRange();
  before.setStart(root, 0);
  before.setEnd(a.node, a.offset);
  const after = document.createRange();
  after.setStart(b.node, b.offset);
  after.setEnd(root, root.childNodes.length);
  return [serialize(before.cloneContents()), serialize(after.cloneContents())];
}

/** Remove the text between two offsets, keeping surrounding formatting. */
export function deleteTextRange(html: string, start: number, end: number): string {
  const [a, b] = splitHtmlAt(html, start, end);
  return a + b;
}

export function textLength(html: string): number {
  return container(html).textContent?.length ?? 0;
}
