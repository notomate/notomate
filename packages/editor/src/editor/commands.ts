import type { ReactNode } from 'react';
import type { BlockProps, BlockType } from './model/types';
import { isTextBlock } from './model/types';
import { allSpecs, getSpec, menuEntries } from './blocks/registry';
import { commit, useEditor } from './model/store';
import { addAfter, createBlock, w } from './model/tree';
import { deleteTextRange } from './inline/splitHtml';
import { htmlToText } from './inline/sanitize';

export interface Command {
  /** Unique per menu entry (a type can have several). */
  key: string;
  type: BlockType;
  label: string;
  hint: string;
  /** Icon name from components/icons, short text such as "H1", or an element. */
  icon: string | ReactNode;
  keywords: string;
  /** Slash menu section; empty for the default one. */
  group: string;
  props?: BlockProps;
  /** Offered in "Turn into". */
  turnInto: boolean;
}

/** Menu entries for the installed block types, grouped by section in order of first use. */
export function commands(): Command[] {
  const list: Command[] = allSpecs().flatMap((s) =>
    menuEntries(s).flatMap((m, i) =>
      m.hidden?.()
        ? []
        : [{
            key: i ? `${s.type}#${i}` : s.type,
            type: s.type,
            label: m.label,
            hint: m.hint ?? '',
            icon: m.icon,
            keywords: `${s.type} ${m.keywords ?? ''}`.toLowerCase(),
            group: m.group ?? '',
            props: m.props ? { ...s.props, ...m.props } : s.props,
            // A type with several entries is turned into through its first one only.
            turnInto: i === 0 && (s.turnInto ?? true),
          }],
    ),
  );
  const groups = [...new Set(list.map((c) => c.group))];
  return groups.flatMap((g) => list.filter((c) => c.group === g));
}

export function filterCommands(query: string): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands();
  return commands().filter((c) => c.label.toLowerCase().includes(q) || c.keywords.includes(q));
}

/** Run a slash command: strip "/query" then convert the block or insert a new one below. */
export function applySlash(cmd: Command) {
  const st = useEditor.getState();
  const slash = st.slash;
  if (!slash) return;
  const b = st.doc.blocks[slash.blockId];
  if (!b) return;
  const html = deleteTextRange(b.html, slash.from, slash.from + 1 + slash.query.length);
  const empty = !htmlToText(html).trim();
  const target = createBlock(cmd.type, '', cmd.props);
  const textual = isTextBlock(target);
  useEditor.setState({ slash: null });
  if (empty) {
    // Notion keeps typing in a fresh paragraph below a divider.
    const below = getSpec(cmd.type)?.trailingParagraph ? createBlock() : null;
    commit((d) => {
      const x = w(d, b.id);
      x.type = cmd.type;
      x.html = textual ? html : '';
      Object.assign(x.props, cmd.props);
      if (below) addAfter(d, below, b.id);
    }, textual ? { focus: { id: b.id, at: 'start' } } : below ? { focus: { id: below.id, at: 'start' } } : { select: [b.id] });
  } else {
    commit((d) => {
      w(d, b.id).html = html;
      addAfter(d, target, b.id);
    }, textual ? { focus: { id: target.id, at: 'start' } } : { select: [target.id] });
  }
  if (!textual) (document.activeElement as HTMLElement | null)?.blur();
}
