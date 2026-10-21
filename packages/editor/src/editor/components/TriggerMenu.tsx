import { useLayoutEffect, useRef, useState } from 'react';
import { applyTrigger, triggerFor, triggerItems, useTrigger } from '../triggers';
import { anchorRect } from './SlashMenu';
import { msg } from '../messages';

const MENU_H = 280;

/** Suggestions for an inline trigger such as `@`, anchored to the trigger character. */
export function TriggerMenu() {
  const active = useTrigger((s) => s.active);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!active) {
      setPos(null);
      return;
    }
    const r = anchorRect(active.blockId, active.from);
    if (!r) return;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const above = r.bottom + MENU_H > vh && r.top > MENU_H;
    setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 280)), y: above ? r.top - 6 : r.bottom + 6, above });
  }, [active?.blockId, active?.from]);

  useLayoutEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  }, [active?.index]);

  if (!active || !pos) return null;
  const items = triggerItems(active);
  const label = triggerFor(active.char)?.label;

  return (
    <div
      ref={listRef}
      className="ui-layer menu slash-menu trigger-menu"
      role="listbox"
      style={{
        left: pos.x,
        top: pos.above ? undefined : pos.y,
        bottom: pos.above ? window.innerHeight - pos.y : undefined,
      }}
      onPointerDown={(e) => e.preventDefault()}
    >
      {label && <div className="menu-label">{label}</div>}
      {items.length === 0 && <div className="menu-empty">{msg().noResults}</div>}
      {items.map((item, i) => (
        <div
          key={item.id}
          role="option"
          aria-selected={i === active.index}
          className={`menu-item ${i === active.index ? 'active' : ''}`}
          onPointerMove={() => i !== active.index && useTrigger.setState({ active: { ...active, index: i } })}
          onClick={() => applyTrigger(item)}
        >
          {item.icon && <span className="menu-icon">{item.icon}</span>}
          <span className="menu-text">
            <span className="menu-title">{item.label}</span>
            {item.hint && <span className="menu-hint">{item.hint}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
