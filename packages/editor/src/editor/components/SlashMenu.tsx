import { useLayoutEffect, useRef, useState } from 'react';
import { useEditor } from '../model/store';
import { applySlash, filterCommands } from '../commands';
import { positionAt } from '../inline/caret';
import { TypeGlyph } from './icons';
import { msg } from '../messages';

const MENU_H = 320;

/**
 * Anchor to a typed character ("/", "@"…) in its own block rather than the live caret:
 * when "+" creates a block, the menu opens before focus has moved there.
 */
export function anchorRect(blockId: string, from: number): DOMRect | null {
  const el = document.querySelector<HTMLElement>(`[data-editable-id="${blockId}"]`);
  if (!el) return null;
  const a = positionAt(el, from);
  const b = positionAt(el, from + 1);
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  const rect = r.getClientRects()[0] ?? r.getBoundingClientRect();
  return rect.height ? rect : el.getBoundingClientRect();
}

export function SlashMenu() {
  const slash = useEditor((s) => s.slash);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!slash) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = anchorRect(slash.blockId, slash.from);
      if (!r) return;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      const above = r.bottom + MENU_H > vh && r.top > MENU_H;
      const x = Math.max(8, Math.min(r.left, window.innerWidth - 300));
      setPos({ x, y: above ? r.top - 6 : r.bottom + 6, above });
    };
    place();
    // The block may be scrolled into view by the focus request that follows.
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [slash?.blockId, slash?.from]);

  useLayoutEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [slash?.index]);

  if (!slash || !pos) return null;
  const items = filterCommands(slash.query);

  return (
    <div
      className="ui-layer menu slash-menu"
      role="listbox"
      aria-label={msg().blockTypes}
      style={{
        left: pos.x,
        top: pos.above ? undefined : pos.y,
        bottom: pos.above ? window.innerHeight - pos.y : undefined,
      }}
      onPointerDown={(e) => e.preventDefault()}
      ref={listRef}
    >
      {items.length === 0 && <div className="menu-empty">{msg().noResults}</div>}
      {items.map((c, i) => [
        (i === 0 || items[i - 1].group !== c.group) && (
          <div key={`group:${c.group}`} className="menu-label">
            {c.group || msg().basicBlocks}
          </div>
        ),
        <div
          key={c.key}
          role="option"
          aria-selected={i === slash.index}
          className={`menu-item ${i === slash.index ? 'active' : ''}`}
          onPointerMove={() => i !== slash.index && useEditor.setState({ slash: { ...slash, index: i } })}
          onClick={() => applySlash(c)}
        >
          <span className="menu-icon">
            <TypeGlyph icon={c.icon} />
          </span>
          <span className="menu-text">
            <span className="menu-title">{c.label}</span>
            <span className="menu-hint">{c.hint}</span>
          </span>
        </div>,
      ])}
    </div>
  );
}
