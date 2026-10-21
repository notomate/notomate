import type { BlockProps, BlockType } from './model/types';
import { allSpecs, contentOf, type PrefixRule } from './blocks/registry';

export interface ShortcutMatch {
  type: BlockType;
  /** Number of prefix characters to remove. */
  length: number;
  props?: BlockProps;
}

function* rules(kind: 'inputRules' | 'pasteRules'): Generator<[PrefixRule, BlockType]> {
  for (const s of allSpecs()) for (const r of s[kind] ?? []) yield [r, s.type];
}

/** Match a Markdown-style prefix that was just typed at the start of a paragraph. */
export function matchShortcut(text: string, caret: number): ShortcutMatch | null {
  const prefix = text.slice(0, caret).replace(/ /g, ' ');
  if (prefix.length > 5) return null;
  for (const [r, type] of rules('inputRules')) {
    if (r.pattern.test(prefix)) return { type, length: prefix.length, props: r.props };
  }
  return null;
}

/** Map a pasted plain-text line to a block type with its prefix stripped. The longest prefix wins. */
export function parseLine(line: string): { type: BlockType; text: string; props?: BlockProps } {
  let best: { type: BlockType; length: number; props?: BlockProps } | null = null;
  for (const [r, type] of rules('pasteRules')) {
    const m = line.match(r.pattern);
    if (m && m.index === 0 && (!best || m[0].length > best.length)) best = { type, length: m[0].length, props: r.props };
  }
  if (!best) return { type: 'paragraph', text: line };
  return { type: best.type, text: contentOf(best.type) === 'none' ? '' : line.slice(best.length), props: best.props };
}
