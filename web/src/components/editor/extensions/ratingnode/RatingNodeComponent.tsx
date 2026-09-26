import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2, Star } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

function PartialStar({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Star size={size} className="text-gray-300 dark:text-muted-foreground" />
      {fill > 0 && (
        <span className="absolute inset-0 overflow-hidden inline-flex" style={{ width: `${fill * 100}%` }}>
          <Star size={size} className="text-yellow-400 fill-yellow-400 shrink-0" />
        </span>
      )}
    </span>
  )
}

const getStarFill = (i: number, val: number) => Math.min(1, Math.max(0, val - (i - 1)))
const formatRating = (r: number) => parseFloat(r.toFixed(1)).toString()

const RatingNodeComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const { rating, maxRating, label } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [isEditing, setIsEditing] = useState(rating === 0 && !label)
  const [hoverRating, setHoverRating] = useState(0)
  const [inputRating, setInputRating] = useState<number>(rating ?? 0)
  const [inputMaxRating, setInputMaxRating] = useState<number>(maxRating ?? 5)
  const [inputLabel, setInputLabel] = useState<string>(label ?? '')
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) setTimeout(() => labelRef.current?.focus(), 0)
  }, [isEditing])

  const handleSubmit = () => {
    updateAttributes({ rating: parseFloat(inputRating.toFixed(1)), maxRating: inputMaxRating, label: inputLabel })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
    if (e.key === 'Escape' && (rating > 0 || label)) {
      setInputRating(rating ?? 0); setInputMaxRating(maxRating ?? 5); setInputLabel(label ?? ''); setIsEditing(false)
    }
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
    { label: 'Edit', icon: <Edit3 size={14} />, onClick: () => { setInputRating(rating ?? 0); setInputMaxRating(maxRating ?? 5); setInputLabel(label ?? ''); setIsEditing(true) } },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  if (isEditing || (rating === 0 && !label)) {
    return (
      <NodeViewWrapper className="rating-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Star size={18} />
            <span className="text-sm font-medium">Rating</span>
          </div>
          <input ref={labelRef} type="text" className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Label (optional)..." value={inputLabel} onChange={e => setInputLabel(e.target.value)} onKeyDown={handleKeyDown} />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rating</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max={inputMaxRating}
                value={inputRating}
                onChange={e => {
                  const val = e.target.valueAsNumber
                  if (!isNaN(val)) setInputRating(Math.min(inputMaxRating, Math.max(0, val)))
                }}
                onKeyDown={handleKeyDown}
                className="w-16 px-2 py-0.5 text-sm rounded border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-muted-foreground">/ {inputMaxRating}</span>
            </div>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {Array.from({ length: inputMaxRating }, (_, i) => i + 1).map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setInputRating(e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i)
                  }}
                  onMouseMove={e => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setHoverRating(e.clientX - rect.left < rect.width / 2 ? i - 0.5 : i)
                  }}
                  className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                >
                  <PartialStar size={24} fill={getStarFill(i, hoverRating || inputRating)} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max stars:</span>
            {[3, 5, 10].map(n => (
              <button key={n} type="button" onClick={() => { setInputMaxRating(n); if (inputRating > n) setInputRating(n) }} className={`px-2 py-0.5 text-xs rounded border transition-colors ${inputMaxRating === n ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 dark:border-neutral-600 text-muted-foreground hover:bg-gray-100 dark:hover:bg-neutral-800'}`}>{n}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors" onClick={handleSubmit}>Save</button>
            {(rating > 0 || label) && (
              <button className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors" onClick={() => { setInputRating(rating ?? 0); setInputMaxRating(maxRating ?? 5); setInputLabel(label ?? ''); setIsEditing(false) }}>Cancel</button>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group my-1">
        <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
          {label && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-neutral-700 text-muted-foreground dark:text-gray-300 select-none">
              {label}
            </span>
          )}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: maxRating }, (_, i) => i + 1).map(i => (
              <PartialStar key={i} size={14} fill={getStarFill(i, rating)} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{formatRating(rating)}/{maxRating}</span>
        </div>
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default RatingNodeComponent
