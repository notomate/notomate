import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import { useEditor } from '../model/store';
import { contentOf } from '../blocks/registry';
import { isCoarsePointer } from '../input/pointer';
import { isMarkActive, linkAtSelection, setColor, setLink, toggleMark, type Mark } from '../inline/marks';
import { msg } from '../messages';

const COLOR_TOKENS = ['default', 'gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];

export const COLORS: { token: string; readonly label: string }[] = COLOR_TOKENS.map((token) => ({
  token,
  get label() {
    return msg().colors[token] ?? token;
  },
}));

interface Saved {
  el: HTMLElement;
  range: Range;
}

/** Link editing needs to survive focus moving into the URL input. */
const useLinkEditor = create<{ saved: Saved | null; open: boolean }>()(() => ({ saved: null, open: false }));

function currentEditable(): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const a = (sel.anchorNode?.parentElement ?? null)?.closest<HTMLElement>('[data-editable-id]');
  const f = (sel.focusNode?.parentElement ?? null)?.closest<HTMLElement>('[data-editable-id]');
  if (!a || a !== f) return null;
  const block = useEditor.getState().doc.blocks[a.dataset.editableId!];
  return block && contentOf(block.type) === 'rich' ? a : null;
}

export function openLinkEditor() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  // A collapsed caret inside an existing link also opens the editor, for that link.
  const el =
    currentEditable() ??
    (sel.anchorNode?.parentElement?.closest<HTMLElement>('[data-editable-id]') ?? null);
  if (!el) return;
  if (sel.isCollapsed) {
    const a = sel.anchorNode?.parentElement?.closest('a');
    if (!a || !el.contains(a)) return;
    const range = document.createRange();
    range.selectNodeContents(a);
    useLinkEditor.setState({ saved: { el, range }, open: true });
    return;
  }
  useLinkEditor.setState({ saved: { el, range: sel.getRangeAt(0).cloneRange() }, open: true });
}

function closeLinkEditor() {
  useLinkEditor.setState({ open: false, saved: null });
}

function restore(saved: Saved) {
  saved.el.focus({ preventScroll: true });
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(saved.range);
}

const sync = (el: HTMLElement) => el.dispatchEvent(new Event('input', { bubbles: true }));

const MARKS: { mark: Mark; label: () => string; glyph: string; cls: string }[] = [
  { mark: 'bold', label: () => msg().bold, glyph: 'B', cls: 'fmt-b' },
  { mark: 'italic', label: () => msg().italic, glyph: 'i', cls: 'fmt-i' },
  { mark: 'underline', label: () => msg().underline, glyph: 'U', cls: 'fmt-u' },
  { mark: 'strike', label: () => msg().strike, glyph: 'S', cls: 'fmt-s' },
  { mark: 'code', label: () => msg().inlineCode, glyph: '</>', cls: 'fmt-code' },
];

export function FormatToolbar() {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [, force] = useState(0);
  const [colorsOpen, setColorsOpen] = useState(false);
  const elRef = useRef<HTMLElement | null>(null);
  const pressed = useRef(false);
  const link = useLinkEditor();
  const [url, setUrl] = useState('');
  const coarse = isCoarsePointer();

  useEffect(() => {
    const update = () => {
      if (useLinkEditor.getState().open) return;
      const el = currentEditable();
      elRef.current = el;
      if (!el || pressed.current) {
        setRect(null);
        setColorsOpen(false);
        return;
      }
      setRect(window.getSelection()!.getRangeAt(0).getBoundingClientRect());
      force((n) => n + 1);
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.format-toolbar')) return;
      if (e.pointerType === 'mouse') pressed.current = true;
    };
    const up = () => {
      pressed.current = false;
      setTimeout(update);
    };
    document.addEventListener('selectionchange', update);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    window.addEventListener('scroll', update, true);
    return () => {
      document.removeEventListener('selectionchange', update);
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  useEffect(() => {
    if (!link.open || !link.saved) return;
    setUrl(linkAtSelectionFrom(link.saved)?.getAttribute('href') ?? '');
    // Clicking anywhere else dismisses the editor, like Notion.
    const outside = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest('.link-editor')) closeLinkEditor();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [link.open, link.saved]);

  const saved = link.saved;
  const anchorRect = link.open && saved ? saved.range.getBoundingClientRect() : rect;
  if (!anchorRect || (!link.open && !elRef.current)) return null;

  // Touch: sit below the selection so the OS selection menu above stays usable.
  const below = coarse || anchorRect.top < 56;
  const style = {
    left: Math.max(8, Math.min(anchorRect.left + anchorRect.width / 2, window.innerWidth - 8)),
    top: below ? anchorRect.bottom + (coarse ? 36 : 8) : anchorRect.top - 8,
  };

  if (link.open && saved) {
    const existing = linkAtSelectionFrom(saved);
    const apply = (href: string | null) => {
      restore(saved);
      setLink(saved.el, href);
      sync(saved.el);
      closeLinkEditor();
    };
    return (
      <form
        noValidate
        className={`ui-layer format-toolbar link-editor ${below ? 'below' : ''}`}
        style={style}
        onSubmit={(e) => {
          e.preventDefault();
          const href = url.trim();
          apply(href ? (/^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`) : null);
        }}
      >
        <input
          autoFocus
          type="text"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={msg().linkPlaceholder}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              restore(saved);
              closeLinkEditor();
            }
          }}
          aria-label={msg().linkUrl}
        />
        <button type="submit" className="link-apply">
          {msg().apply}
        </button>
        {existing ? (
          <button type="button" className="link-secondary" onClick={() => apply(null)} title={msg().removeLink}>
            {msg().remove}
          </button>
        ) : (
          <button
            type="button"
            className="link-secondary"
            onClick={() => {
              restore(saved);
              closeLinkEditor();
            }}
          >
            {msg().cancel}
          </button>
        )}
      </form>
    );
  }

  const el = elRef.current!;
  return (
    <div
      className={`ui-layer format-toolbar ${below ? 'below' : ''}`}
      style={style}
      onPointerDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label={msg().textFormat}
    >
      {MARKS.map((m) => (
        <button
          key={m.mark}
          type="button"
          className={`fmt ${m.cls} ${isMarkActive(el, m.mark) ? 'on' : ''}`}
          title={m.label()}
          aria-label={m.label()}
          aria-pressed={isMarkActive(el, m.mark)}
          onClick={() => {
            toggleMark(el, m.mark);
            sync(el);
            force((n) => n + 1);
          }}
        >
          {m.glyph}
        </button>
      ))}
      <span className="fmt-sep" />
      <button
        type="button"
        className={`fmt fmt-link ${linkAtSelection(el) ? 'on' : ''}`}
        title={msg().linkShortcut}
        aria-label={msg().link}
        aria-pressed={!!linkAtSelection(el)}
        onClick={openLinkEditor}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.1-2.1a2.6 2.6 0 0 0-3.7-3.7l-.7.7m.4 4.3a2.6 2.6 0 0 0-3.7 0L2.6 10.7a2.6 2.6 0 0 0 3.7 3.7l.7-.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div className="fmt-color-wrap">
        <button
          type="button"
          className="fmt fmt-color"
          title={msg().textColor}
          aria-label={msg().textColor}
          aria-expanded={colorsOpen}
          onClick={() => setColorsOpen((o) => !o)}
        >
          A<span className="caret-down">▾</span>
        </button>
        {colorsOpen && (
          <div className="menu color-menu">
            <div className="menu-label">{msg().textColor}</div>
            {COLORS.map((c) => (
              <button
                key={c.token}
                type="button"
                className="menu-item compact"
                onClick={() => {
                  setColor(el, c.token);
                  sync(el);
                  setColorsOpen(false);
                }}
              >
                <span className="swatch" data-color={c.token}>A</span>
                {c.label}
              </button>
            ))}
            <div className="menu-label">{msg().backgroundColor}</div>
            {COLORS.slice(1).map((c) => (
              <button
                key={`${c.token}_bg`}
                type="button"
                className="menu-item compact"
                onClick={() => {
                  setColor(el, `${c.token}_bg`);
                  sync(el);
                  setColorsOpen(false);
                }}
              >
                <span className="swatch" data-color={`${c.token}_bg`}>A</span>
                {msg().colorBackground(c.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The link inside or around the saved range, if any. */
function linkAtSelectionFrom(saved: Saved): HTMLAnchorElement | null {
  const n = saved.range.commonAncestorContainer;
  const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
  const around = el?.closest('a');
  if (around && saved.el.contains(around)) return around;
  return Array.from(saved.el.querySelectorAll('a')).find((a) => saved.range.intersectsNode(a)) ?? null;
}
