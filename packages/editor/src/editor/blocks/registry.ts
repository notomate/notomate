import type { ComponentType, ReactNode } from 'react';
import type { Block, BlockProps } from '../model/types';

export interface BlockComponentProps {
  block: Block;
  /** Nesting level, 0 for top-level blocks. */
  depth: number;
}

/** A prefix rule: typed at the start of a paragraph, or leading a pasted text line. */
export interface PrefixRule {
  pattern: RegExp;
  props?: BlockProps;
}

/** A block-specific command in the block menu (desktop handle menu and touch sheet). */
export interface BlockAction {
  /** Stable key. */
  id: string;
  label: string;
  /** Built-in icon name or your own element. */
  icon?: string | ReactNode;
  danger?: boolean;
  /** Runs after the menu closes. */
  onSelect: () => void;
}

export interface BlockMenuEntry {
  label: string;
  hint?: string;
  /** Built-in icon name (see `Icon`), short text such as "H1", or your own element. */
  icon: string | ReactNode;
  /** Extra search terms, space separated. */
  keywords?: string;
  /** Section heading in the slash menu; sections appear in order of first use. */
  group?: string;
  /** Checked each time the menu opens, e.g. to offer a block only when a service is configured. */
  hidden?: () => boolean;
  /** Props for a block created from this entry, on top of the spec's `props`. */
  props?: BlockProps;
}

/** A spec's menu entries as a list. */
export const menuEntries = (spec: BlockSpec): readonly BlockMenuEntry[] =>
  !spec.menu ? [] : Array.isArray(spec.menu) ? spec.menu : [spec.menu as BlockMenuEntry];

export interface BlockSpec {
  /** Stored in `Block.type`. */
  type: string;
  /** Renders the block body. Use `BlockText` for its editable text. */
  component: ComponentType<BlockComponentProps>;
  /**
   * Entry in the slash menu and "Turn into"; omit to hide the type from menus. Several
   * entries can create the same type with different `props` (e.g. kinds of embedded view).
   */
  menu?: BlockMenuEntry | readonly BlockMenuEntry[];
  /** Extra entries at the top of the block menu when this is the only selected block. */
  actions?: (block: Block) => BlockAction[];
  /** Props for a newly created block; on "Turn into" they only fill in missing keys. */
  props?: BlockProps;
  /**
   * `rich` (default): inline-formatted text. `plain`: text without formatting where
   * Enter / Tab insert characters (code). `none`: no text at all (divider, image).
   */
  content?: 'rich' | 'plain' | 'none';
  /** May contain nested blocks. Defaults to true for `rich` content. */
  nestable?: boolean;
  /** Enter on a non-empty block continues with the same type (lists). */
  continues?: boolean;
  /** Enter on an empty block steps out (outdent, or back to paragraph) instead of adding a block. */
  exitOnEmpty?: boolean;
  /** Children are shown only while `props.open` is true (toggle). */
  collapsible?: boolean;
  /** After inserting this block from an empty line, keep typing in a fresh paragraph below. */
  trailingParagraph?: boolean;
  /** Offer in "Turn into". Default true when `menu` is set. */
  turnInto?: boolean;
  /** Placeholder for `BlockText`. */
  placeholder?: string;
  /** Markdown-style prefixes typed at the start of a paragraph, e.g. `/^#\s$/`. */
  inputRules?: PrefixRule[];
  /** Prefixes of pasted plain-text lines; the matched prefix is stripped. Longest match wins. */
  pasteRules?: PrefixRule[];
  /** Pasted HTML elements this type is created from. */
  parseHtml?: {
    tags: string[];
    match?: (el: Element) => boolean;
    /** Props read from the element (e.g. an image's src); content inside a non-text block is not parsed further. */
    props?: (el: Element) => BlockProps;
  };
  /** Ctrl/Cmd+Enter while editing (e.g. tick a todo). */
  onModEnter?: (block: Block) => void;
  /** Copy as Markdown. `text` is the plain text; `index` is the 1-based run among same-type siblings. */
  toMarkdown?: (block: Block, text: string, index: number) => string;
  /** Copy as HTML for other apps. Defaults to `<p>`. */
  toHtml?: (block: Block) => string;
}

let specs = new Map<string, BlockSpec>();

/** Install the block types the editor offers. Later entries replace earlier ones with the same type. */
export function setBlocks(list: readonly BlockSpec[]) {
  specs = new Map(list.map((s) => [s.type, s]));
}

export const getSpec = (type: string): BlockSpec | undefined => specs.get(type);
export const allSpecs = (): BlockSpec[] => [...specs.values()];
export const hasBlock = (type: string) => specs.has(type);

export const contentOf = (type: string) => specs.get(type)?.content ?? 'rich';
export const isNestable = (type: string) => specs.get(type)?.nestable ?? contentOf(type) === 'rich';
export const isCollapsed = (b: Block) => !!specs.get(b.type)?.collapsible && !b.props.open;
