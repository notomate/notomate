import { createContext, useContext, useMemo, type ComponentType, type HTMLAttributes, type MouseEvent } from 'react'
import {
  deleteBlocks,
  selectBlocks,
  setProps,
  setPropsQuietly,
  useEditor,
  type Block,
  type BlockAction,
  type BlockComponentProps,
  type BlockMenuEntry,
  type BlockSpec,
} from '@notomate/editor'
import type { createNote } from '@/api/note'
import type { listFiles } from '@/api/file'
import type { createView, deleteView } from '@/api/view'

/**
 * Lets the notomate node components (written as TipTap node views) run as blocks of
 * @notomate/editor: same prop names, backed by the block's props.
 */

export interface UploadResult {
  src: string
  name: string
}

/** What the node components used to get as TipTap extension options. */
export interface NodeOptions {
  workspaceId: string
  /** The note being edited. */
  noteId: string
  parentNoteId: string
  upload: (file: File, onProgress?: (percent: number) => void) => Promise<UploadResult>
  listFiles: typeof listFiles
  createNote: typeof createNote
  createView: typeof createView
  deleteView: typeof deleteView
}

export const NodeOptionsContext = createContext<NodeOptions | null>(null)

/** Node attributes are free-form JSON, as in TipTap's `NodeViewProps` the components were written for. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attrs = Record<string, any>

export interface NodeViewProps {
  node: { attrs: Attrs; type: { name: string } }
  /** Change attributes; `history: false` keeps it out of undo (e.g. an upload finishing). */
  updateAttributes: (attrs: Attrs, opts?: { history?: boolean }) => void
  deleteNode: () => void
  /** The block is in the editor's block selection. */
  selected: boolean
  editor: { isEditable: boolean }
  extension: { options: NodeOptions }
  /** Kept for the drag-menu hook's signature; blocks have no document positions. */
  getPos: () => number | undefined
}

const BlockIdContext = createContext<string | null>(null)
export const useNodeBlockId = () => useContext(BlockIdContext)

/** Root element of a node view. Owns its pointer input (no marquee). */
export function NodeViewWrapper({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const id = useNodeBlockId()
  return (
    <div
      {...props}
      className={`no-marquee ${className}`}
      data-node-view=""
      onClick={(e: MouseEvent<HTMLDivElement>) => {
        props.onClick?.(e)
        // A click on the card itself (not one of its controls) selects the block.
        const target = e.target as HTMLElement
        if (!id || e.defaultPrevented || target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"], iframe')) return
        ;(document.activeElement as HTMLElement | null)?.blur?.()
        selectBlocks([id])
      }}
    />
  )
}

// ---------------------------------------------------------------- block actions

export interface MenuAction {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
}

/** Actions the mounted node components registered, by block id. */
const registered = new Map<string, () => MenuAction[]>()

export function registerNodeActions(id: string, get: () => MenuAction[]) {
  registered.set(id, get)
  return () => {
    if (registered.get(id) === get) registered.delete(id)
  }
}

function actionsOf(block: Block): BlockAction[] {
  return (registered.get(block.id)?.() ?? []).map((a, i) => ({
    id: `${i}:${a.label}`,
    label: a.label,
    icon: a.icon,
    danger: a.variant === 'danger',
    onSelect: a.onClick,
  }))
}

// ---------------------------------------------------------------- spec factory

interface NodeSpecOptions {
  /** Attributes of a newly inserted node. */
  defaults: Record<string, unknown>
  menu?: BlockMenuEntry | readonly BlockMenuEntry[]
  /** Pasted HTML elements this node is created from. */
  parseHtml?: BlockSpec['parseHtml']
}

/** A notomate node as an editor block type. */
export function nodeSpec(type: string, Component: ComponentType<NodeViewProps>, { defaults, menu, parseHtml }: NodeSpecOptions): BlockSpec {
  function NodeBlock({ block }: BlockComponentProps) {
    const options = useContext(NodeOptionsContext)
    const selected = useEditor((s) => s.selection.ids.includes(block.id))
    const props = useMemo<NodeViewProps>(
      () => ({
        node: { attrs: { ...defaults, ...block.props }, type: { name: type } },
        updateAttributes: (attrs, opts) =>
          opts?.history === false ? setPropsQuietly([block.id], attrs) : setProps([block.id], attrs),
        deleteNode: () => deleteBlocks([block.id]),
        selected,
        editor: { isEditable: true },
        extension: { options: options ?? ({} as NodeOptions) },
        getPos: () => undefined,
      }),
      [block.id, block.props, selected, options],
    )
    return (
      <BlockIdContext.Provider value={block.id}>
        <Component {...props} />
      </BlockIdContext.Provider>
    )
  }
  NodeBlock.displayName = `NodeBlock(${type})`

  return {
    type,
    component: NodeBlock,
    content: 'none' as const,
    turnInto: false,
    props: defaults,
    actions: actionsOf,
    menu,
    parseHtml,
  }
}
