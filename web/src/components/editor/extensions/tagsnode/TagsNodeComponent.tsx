import { NodeViewProps, NodeViewWrapper } from '@tiptap/react'
import { ChevronUp, ChevronDown, Trash2, X, Plus } from 'lucide-react'
import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react'
import { useDragMenu, NodeTouchMenu } from '@/components/editor/DragMenuContext'

const TAG_STYLE = { bg: 'bg-gray-100 dark:bg-neutral-700', text: 'text-gray-600 dark:text-gray-300' }

function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const { bg, text } = TAG_STYLE
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text} select-none`}>
      <span className="opacity-50">#</span>{label}
      {onRemove && (
        <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors" tabIndex={-1}>
          <X size={10} strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}

const TagsNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const tags: string[] = node.attrs.tags ?? []
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [inputValue, setInputValue] = useState('')
  const [_, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditable && tags.length === 0) setTimeout(() => inputRef.current?.focus(), 50)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/^#+/, '')
    if (!trimmed || tags.includes(trimmed)) return
    updateAttributes({ tags: [...tags, trimmed] })
  }

  const removeTag = (idx: number) => updateAttributes({ tags: tags.filter((_, i) => i !== idx) })

  const commitInput = () => {
    inputValue.split(/[,，\s]+/).forEach(t => addTag(t))
    setInputValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); commitInput() }
    else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) removeTag(tags.length - 1)
    else if (e.key === 'Escape') { setInputValue(''); inputRef.current?.blur() }
  }

  const handleMoveUp = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() === 0) return
    const nodeBefore = $pos.nodeBefore
    if (!nodeBefore) return
    editor.view.dispatch(state.tr.replaceWith(pos - nodeBefore.nodeSize, pos + node.nodeSize, [node, nodeBefore]))
  }, [editor, node, getPos])

  const handleMoveDown = useCallback(() => {
    const pos = getPos()
    if (pos === undefined) return
    const { state } = editor
    const $pos = state.doc.resolve(pos)
    if ($pos.index() >= $pos.parent.childCount - 1) return
    const nodeAfterPos = pos + node.nodeSize
    const nodeAfter = state.doc.resolve(nodeAfterPos).nodeAfter
    if (!nodeAfter) return
    editor.view.dispatch(state.tr.replaceWith(pos, nodeAfterPos + nodeAfter.nodeSize, [nodeAfter, node]))
  }, [editor, node, getPos])

  const nodeActions = [
    { label: 'Move up', icon: <ChevronUp size={14} />, onClick: handleMoveUp },
    { label: 'Move down', icon: <ChevronDown size={14} />, onClick: handleMoveDown },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  if (!isEditable) {
    if (tags.length === 0) return null
    return (
      <NodeViewWrapper>
        <div className="flex flex-wrap gap-1.5 my-1">
          {tags.map(t => <TagChip key={t} label={t} />)}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group my-1">
        <div className="flex flex-wrap items-center gap-1.5 px-1 py-1 cursor-text" onClick={() => inputRef.current?.focus()}>
          {tags.map((t, i) => <TagChip key={t} label={t} onRemove={() => removeTag(i)} />)}
          <input
            ref={inputRef}
            type="text"
            className="flex-1 min-w-[120px] bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none border-none"
            placeholder={tags.length === 0 ? 'Add tags… (Enter or comma to confirm)' : 'Add tag…'}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => { setIsFocused(false); commitInput() }}
          />
          {inputValue.trim() && (
            <button onMouseDown={e => { e.preventDefault(); commitInput() }} className="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-500 transition-colors" tabIndex={-1}>
              <Plus size={14} />
            </button>
          )}
        </div>
        {isTouchDevice && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default TagsNodeComponent
