import { useLayoutEffect, useRef, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import { clearSelection, commit, setFocusedId, useEditor } from '../model/store';
import { createBlock, w } from '../model/tree';
import { onTextKeyDown } from '../keyboard/textKeys';
import { getSelectionOffsets, selectRange } from '../inline/caret';
import { normalizeEmpty, sanitizeInline } from '../inline/sanitize';
import { deleteTextRange } from '../inline/splitHtml';
import { matchShortcut } from '../markdownShortcuts';
import { filterCommands } from '../commands';
import { insertFragment, insertBlockAfter, setHtml } from '../ops';
import { fragmentFromHtml, fragmentFromText, readFragment } from '../clipboard';
import { contentOf, getSpec, hasBlock } from '../blocks/registry';
import { closeTrigger, updateTrigger } from '../triggers';
import { runTransfer, type TransferContext } from '../plugins';

interface Props {
  id: string;
  html: string;
  className?: string;
  placeholder?: string;
  /** Show the placeholder even when not focused (headings, list items). */
  alwaysPlaceholder?: boolean;
  plain?: boolean;
}

const SLASH_CHARS = new Set(['/', '、']);

function handleInput(el: HTMLElement, id: string, data: string | null) {
  const html = normalizeEmpty(el.innerHTML);
  if (!html && el.innerHTML) el.innerHTML = '';
  el.dataset.empty = String(!el.textContent);
  const st = useEditor.getState();
  const block = st.doc.blocks[id];
  if (!block) return;
  const caret = getSelectionOffsets(el)?.start ?? 0;
  const text = el.textContent ?? '';

  if (block.type === 'paragraph') {
    const m = matchShortcut(text, caret);
    if (m) {
      const rest = deleteTextRange(html, 0, m.length);
      commit((d) => {
        const x = w(d, id);
        x.type = m.type;
        x.html = contentOf(m.type) === 'none' ? '' : rest;
        Object.assign(x.props, getSpec(m.type)?.props, m.props);
      }, { focus: { id, at: 'start' } });
      useEditor.setState({ slash: null });
      if (getSpec(m.type)?.trailingParagraph) insertBlockAfter(id);
      return;
    }
  }

  setHtml(id, html);
  if (contentOf(block.type) === 'rich') updateTrigger(id, data, text, caret);

  const slash = st.slash;
  if (data && SLASH_CHARS.has(data) && contentOf(block.type) !== 'plain') {
    const before = text[caret - 2];
    if (caret === 1 || before === ' ' || before === ' ') {
      useEditor.setState({ slash: { blockId: id, from: caret - 1, query: '', index: 0 } });
      return;
    }
  }
  if (slash && slash.blockId === id) {
    if (caret <= slash.from || !SLASH_CHARS.has(text[slash.from])) {
      useEditor.setState({ slash: null });
      return;
    }
    const query = text.slice(slash.from + 1, caret);
    const tooFar = /\s\s/.test(query) || (!filterCommands(query).length && /\s$/.test(query));
    useEditor.setState({ slash: tooFar ? null : { ...slash, query, index: 0 } });
  }
}

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Hand a paste / drop to plugins; when one takes it, the browser default is cancelled. */
function runTransferEvent(
  kind: 'onPaste' | 'onDrop',
  e: ClipboardEvent<HTMLElement> | DragEvent<HTMLElement>,
  ctx: TransferContext,
): boolean {
  const data = 'clipboardData' in e ? e.clipboardData : e.dataTransfer;
  if (!data || !runTransfer(kind, data, ctx)) return false;
  e.preventDefault();
  return true;
}

function handlePaste(e: ClipboardEvent<HTMLElement>, id: string, plain: boolean) {
  const cd = e.clipboardData;
  const el = e.currentTarget;
  const frag = readFragment(cd);
  if (frag && !plain) {
    e.preventDefault();
    insertFragment(id, frag);
    return;
  }
  const ctx: TransferContext = { blockId: id, plain };
  if (runTransferEvent('onPaste', e, ctx)) return;
  const image = Array.from(cd.files).find((f) => f.type.startsWith('image/'));
  if (image && !plain && hasBlock('image')) {
    e.preventDefault();
    void readImage(image).then((src) => {
      const img = createBlock('image', '', { src, width: 100 });
      insertFragment(id, { blocks: { [img.id]: img }, rootIds: [img.id] });
    });
    return;
  }
  const text = cd.getData('text/plain');
  e.preventDefault();
  if (plain) {
    document.execCommand('insertText', false, text);
    return;
  }
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed && /^https?:\/\/\S+$/.test(text.trim())) {
    document.execCommand('createLink', false, text.trim());
    return;
  }
  const html = cd.getData('text/html');
  const multi = html ? fragmentFromHtml(html) : null;
  if (multi) {
    insertFragment(id, multi);
    return;
  }
  if (text.includes('\n')) {
    const f = fragmentFromText(text);
    if (f.rootIds.length > 1) {
      insertFragment(id, f);
      return;
    }
  }
  if (html) document.execCommand('insertHTML', false, sanitizeInline(html));
  else document.execCommand('insertText', false, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Uncontrolled contentEditable. The DOM is the source of truth while typing;
 * the store is written on input and only pushed back into the DOM when it
 * changes from elsewhere (undo, merge, turn-into…), so the caret never jumps.
 */
export function EditableText({ id, html, className = '', placeholder, alwaysPlaceholder, plain }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    if (normalizeEmpty(el.innerHTML) !== html) {
      // Keep the caret where it was when the text changes underneath it (e.g. a collaborator's edit).
      const caret = document.activeElement === el ? getSelectionOffsets(el) : null;
      el.innerHTML = html;
      if (caret) {
        const len = el.textContent?.length ?? 0;
        selectRange(el, Math.min(caret.start, len), Math.min(caret.end, len));
      }
    }
    el.dataset.empty = String(!el.textContent);
  }, [html]);

  return (
    <div
      ref={ref}
      className={`editable ${alwaysPlaceholder ? 'always-ph' : ''} ${className}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-editable-id={id}
      data-placeholder={placeholder}
      onInput={(e: FormEvent<HTMLDivElement>) =>
        handleInput(e.currentTarget, id, (e.nativeEvent as InputEvent).data ?? null)
      }
      onKeyDown={(e) => onTextKeyDown(e, id)}
      onPaste={(e) => handlePaste(e, id, !!plain)}
      onFocus={() => {
        clearSelection();
        setFocusedId(id);
      }}
      onBlur={() => {
        setFocusedId(null);
        closeTrigger();
        const s = useEditor.getState().slash;
        if (s?.blockId === id) useEditor.setState({ slash: null });
      }}
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest('a');
        if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
      }}
      onDrop={(e) => {
        // Never let the browser insert raw dropped HTML; plugins may upload dropped files.
        if (!runTransferEvent('onDrop', e, { blockId: id, plain: !!plain })) e.preventDefault();
      }}
    />
  );
}
