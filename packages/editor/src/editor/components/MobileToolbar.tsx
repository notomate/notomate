import { useEffect, useState } from 'react';
import { redo, selectBlocks, undo, useEditor } from '../model/store';
import { indentBlocks, outdentBlocks } from '../ops';
import { getSelectionOffsets } from '../inline/caret';
import { msg } from '../messages';
import { Icon, type IconName } from './icons';

function focusedEditable(): HTMLElement | null {
  return (document.activeElement as HTMLElement | null)?.closest?.('[data-editable-id]') ?? null;
}

/** Keyboard accessory bar for touch devices, pinned above the on-screen keyboard. */
export function MobileToolbar() {
  const focusedId = useEditor((s) => s.focusedId);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const place = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    place();
    vv.addEventListener('resize', place);
    vv.addEventListener('scroll', place);
    return () => {
      vv.removeEventListener('resize', place);
      vv.removeEventListener('scroll', place);
    };
  }, []);

  if (!focusedId) return null;
  const at = () => {
    const el = focusedEditable();
    return (el && getSelectionOffsets(el)?.start) ?? 0;
  };
  const btn = (label: string, icon: IconName, fn: () => void) => (
    <button type="button" aria-label={label} title={label} onClick={fn}>
      <Icon name={icon} size={20} />
    </button>
  );

  return (
    <div
      className="ui-layer mobile-toolbar"
      style={{ bottom }}
      onPointerDown={(e) => e.preventDefault()}
      role="toolbar"
      aria-label={msg().editTools}
    >
      {btn(msg().insertBlock, 'plus', () => {
        if (at() > 0) document.execCommand('insertText', false, ' ');
        document.execCommand('insertText', false, '/');
      })}
      {btn(msg().indent, 'indent', () => indentBlocks([focusedId], { id: focusedId, at: at() }))}
      {btn(msg().outdent, 'outdent', () => outdentBlocks([focusedId], { id: focusedId, at: at() }))}
      {btn(msg().selectBlock, 'select', () => {
        focusedEditable()?.blur();
        selectBlocks([focusedId]);
        const row = document.querySelector(`[data-block-id="${focusedId}"] .handle`);
        const r = row?.getBoundingClientRect();
        useEditor.setState({ blockMenu: { x: r?.left ?? 0, y: r?.bottom ?? 0 } });
      })}
      {btn(msg().undo, 'undo', undo)}
      {btn(msg().redo, 'redo', redo)}
      <span className="spacer" />
      {btn(msg().done, 'chevronDown', () => focusedEditable()?.blur())}
    </div>
  );
}
