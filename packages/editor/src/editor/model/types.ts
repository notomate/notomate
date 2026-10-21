import { contentOf, isNestable } from '../blocks/registry';

/** Block type name; see `BlockSpec`. `paragraph` is always available. */
export type BlockType = string;

export interface BlockProps {
  checked?: boolean;
  open?: boolean;
  icon?: string;
  src?: string;
  /** Image width as a percentage of the column. */
  width?: number;
  /** Notion-style color token, e.g. "red" (text) or "red_bg" (background). */
  color?: string;
  /** Custom block types may store their own props. */
  [key: string]: unknown;
}

export interface Block {
  id: string;
  type: BlockType;
  /** Inline HTML (b, i, u, s, code, a, span[data-color], br). */
  html: string;
  props: BlockProps;
  children: string[];
  parentId: string | null;
}

export interface Doc {
  title: string;
  blocks: Record<string, Block>;
  rootIds: string[];
}

export type DropPosition = 'before' | 'after' | 'inside';

export const isTextBlock = (b: Block) => contentOf(b.type) !== 'none';
export const canHaveChildren = (b: Block) => isNestable(b.type);
