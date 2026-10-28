import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { clearSelection, useEditor } from '../model/store';
import { isCoarsePointer } from '../input/pointer';
import { commands } from '../commands';
import { getSpec } from '../blocks/registry';
import { isTextBlock } from '../model/types';
import { COLORS } from './FormatToolbar';
import { deleteBlocks, duplicateBlocks, fragmentOf, indentBlocks, outdentBlocks, setProps, turnInto } from '../ops';
import { moveSelection } from '../selection/blockKeyboard';
import { writeFragment } from '../clipboard';
import { Icon, TypeGlyph } from './icons';
import { msg } from '../messages';

type Panel = 'main' | 'turn' | 'color';

async function copyToClipboard(ids: string[]) {
  const dt = new DataTransfer();
  writeFragment(dt, fragmentOf(ids));
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([dt.getData('text/plain')], { type: 'text/plain' }),
        'text/html': new Blob([dt.getData('text/html')], { type: 'text/html' }),
      }),
    ]);
  } catch {
    await navigator.clipboard?.writeText(dt.getData('text/plain'));
  }
}

export function BlockMenu() {
  const menu = useEditor((s) => s.blockMenu);
  const ids = useEditor((s) => s.selection.ids);
  const first = useEditor((s) => (s.selection.ids[0] ? s.doc.blocks[s.selection.ids[0]] : undefined));
  const firstType = first?.type;
  const currentColor = first?.props.color;
  // Turn into / colour only make sense for text; an image turned into a paragraph would lose it.
  const textual = useEditor((s) => s.selection.ids.every((id) => s.doc.blocks[id] && isTextBlock(s.doc.blocks[id])));
  const typeLabel = commands().find((c) => c.type === firstType)?.label ?? msg().block;
  const [panel, setPanel] = useState<Panel>('main');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const sheet = isCoarsePointer();

  useLayoutEffect(() => {
    setPanel('main');
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || sheet || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      top: menu.y + r.height > window.innerHeight - 8 ? Math.max(8, menu.y - r.height - 32) : menu.y,
    });
  }, [menu, panel, sheet]);

  if (!menu || !ids.length) return null;
  const close = () => useEditor.setState({ blockMenu: null });
  const actions = ids.length === 1 && first ? (getSpec(first.type)?.actions?.(first) ?? []) : [];
  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  const item = (icon: string | ReactNode, label: string, onClick: () => void, extra?: { kbd?: string; danger?: boolean; sub?: boolean }) => (
    <button type="button" role="menuitem" className={`menu-item ${extra?.danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="menu-icon">
        <TypeGlyph icon={icon} />
      </span>
      <span className="menu-title">{label}</span>
      {extra?.kbd && !sheet && <kbd>{extra.kbd}</kbd>}
      {extra?.sub && (
        <span className="menu-chevron">
          <Icon name="chevronRight" size={16} />
        </span>
      )}
    </button>
  );

  const back = (label: string) => (
    <button type="button" className="menu-back" onClick={() => setPanel('main')}>
      <Icon name="chevronLeft" size={16} />
      {label}
    </button>
  );

  const main = (
    <>
      <div className="menu-label">{sheet || ids.length > 1 ? msg().selectedBlocks(ids.length) : typeLabel}</div>
      {actions.map((a) => (
        <Fragment key={a.id}>
          {item(a.icon ?? '', a.label, () => {
            close();
            a.onSelect();
          }, { danger: a.danger })}
        </Fragment>
      ))}
      {actions.length > 0 && <div className="menu-sep" />}
      {textual && (
        <>
          {item('turnInto', msg().turnInto, () => setPanel('turn'), { sub: true })}
          {item('color', msg().color, () => setPanel('color'), { sub: true })}
          <div className="menu-sep" />
        </>
      )}
      {item('duplicate', msg().duplicate, run(() => duplicateBlocks(ids)), { kbd: 'Ctrl+D' })}
      {item('copy', msg().copy, run(() => void copyToClipboard(ids)), { kbd: 'Ctrl+C' })}
      {/* The sheet has these in its button grid below. */}
      {!sheet && (
        <>
          <div className="menu-sep" />
          {item('moveUp', msg().moveUp, run(() => moveSelection(ids, -1)), { kbd: 'Ctrl+Shift+↑' })}
          {item('moveDown', msg().moveDown, run(() => moveSelection(ids, 1)), { kbd: 'Ctrl+Shift+↓' })}
        </>
      )}
      {sheet && (
        <>
          <div className="menu-sep" />
          <div className="menu-grid">
            {(
              [
                ['moveUp', msg().moveUp, () => moveSelection(ids, -1)],
                ['moveDown', msg().moveDown, () => moveSelection(ids, 1)],
                ['outdent', msg().outdent, () => outdentBlocks(ids)],
                ['indent', msg().indent, () => indentBlocks(ids)],
              ] as const
            ).map(([icon, label, fn]) => (
              <button key={icon} type="button" className="grid-btn" onClick={fn} aria-label={label}>
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="menu-sep" />
      {item('trash', msg().delete, run(() => deleteBlocks(ids)), { kbd: 'Del', danger: true })}
    </>
  );

  const turn = (
    <>
      {back(msg().turnInto)}
      {commands().filter((c) => c.turnInto).map((c) => (
        <button
          key={c.key}
          type="button"
          role="menuitemradio"
          aria-checked={firstType === c.type}
          className="menu-item"
          onClick={run(() => turnInto(ids, c.type))}
        >
          <span className="menu-icon tile">
            <TypeGlyph icon={c.icon} />
          </span>
          <span className="menu-title">{c.label}</span>
          {firstType === c.type && (
            <span className="menu-check">
              <Icon name="check" size={16} />
            </span>
          )}
        </button>
      ))}
    </>
  );

  const colorRow = (token: string, label: string, value: string | undefined) => (
    <button
      key={token}
      type="button"
      role="menuitemradio"
      aria-checked={currentColor === value}
      className="menu-item compact"
      onClick={run(() => setProps(ids, { color: value }))}
    >
      <span className="swatch" data-color={token}>A</span>
      <span className="menu-title">{label}</span>
      {currentColor === value && (
        <span className="menu-check">
          <Icon name="check" size={16} />
        </span>
      )}
    </button>
  );

  const color = (
    <>
      {back(msg().color)}
      <div className="menu-label">{msg().textColor}</div>
      {COLORS.map((c) => colorRow(c.token, c.label, c.token === 'default' ? undefined : c.token))}
      <div className="menu-label">{msg().backgroundColor}</div>
      {COLORS.slice(1).map((c) => colorRow(`${c.token}_bg`, msg().colorBackground(c.label), `${c.token}_bg`))}
    </>
  );

  const body = panel === 'turn' ? turn : panel === 'color' ? color : main;

  return (
    <>
      <div
        className={`ui-layer menu-backdrop ${sheet ? 'dim' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          close();
          if (sheet) clearSelection();
        }}
      />
      <div
        ref={ref}
        className={`ui-layer menu block-menu ${sheet ? 'sheet' : ''}`}
        role="menu"
        style={sheet ? undefined : { left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
        onPointerDown={(e) => e.preventDefault()}
      >
        {sheet && <div className="sheet-grip" aria-hidden="true" />}
        {body}
      </div>
    </>
  );
}
