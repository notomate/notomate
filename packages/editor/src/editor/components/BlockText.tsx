import type { Block } from '../model/types';
import { useEditor } from '../model/store';
import { listNumber } from '../model/tree';
import { contentOf, getSpec } from '../blocks/registry';
import { EditableText } from './EditableText';
import { msg } from '../messages';

export interface BlockTextProps {
  block: Block;
  className?: string;
  /** Defaults to the spec's `placeholder`. */
  placeholder?: string;
}

/** The editable text of a block, for use inside a `BlockSpec` component. */
export function BlockText({ block, className, placeholder }: BlockTextProps) {
  return (
    <EditableText
      id={block.id}
      html={block.html}
      className={className}
      placeholder={placeholder ?? getSpec(block.type)?.placeholder ?? msg().placeholder}
      alwaysPlaceholder={block.type !== 'paragraph'}
      plain={contentOf(block.type) === 'plain'}
    />
  );
}

/** 1-based position among consecutive siblings of the same type (numbered lists). */
export function useListNumber(id: string): number {
  return useEditor((s) => (s.doc.blocks[id] ? listNumber(s.doc, id) : 0));
}

/** Plain text row; also used for block types that are not installed. */
export function TextBlock({ block }: { block: Block }) {
  return (
    <div className="text">
      <BlockText block={block} />
    </div>
  );
}
