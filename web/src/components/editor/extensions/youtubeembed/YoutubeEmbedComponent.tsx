import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { Youtube, ChevronUp, ChevronDown, Edit3, Trash2 } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

function extractYoutubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('?')[0] || null
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v')
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/embed/')[1].split('?')[0] || null
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/shorts/')[1].split('?')[0] || null
      }
    }
  } catch {
    // not a valid URL
  }
  return null
}

const YoutubeEmbedComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const { url } = node.attrs
  const videoId = url ? extractYoutubeId(url) : null
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [isEditing, setIsEditing] = useState(!url)
  const [inputValue, setInputValue] = useState(url ?? '')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isEditing])

  const handleSubmit = () => {
    const id = extractYoutubeId(inputValue.trim())
    if (!id) {
      setError(true)
      return
    }
    setError(false)
    updateAttributes({ url: inputValue.trim() })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') {
      if (url) {
        setInputValue(url)
        setIsEditing(false)
        setError(false)
      }
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
    { label: 'Edit URL', icon: <Edit3 size={14} />, onClick: () => { setInputValue(url); setIsEditing(true) } },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: deleteNode, variant: 'danger' as const },
  ]

  useDragMenu(getPos, () => nodeActions)

  if (isEditing || !videoId) {
    return (
      <NodeViewWrapper className="youtube-embed-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Youtube size={18} />
            <span className="text-sm font-medium">YouTube Embed</span>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 px-3 py-2 text-sm rounded border ${error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-neutral-600'} bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Paste YouTube URL..."
              value={inputValue}
              onChange={e => { setInputValue(e.target.value); setError(false) }}
              onKeyDown={handleKeyDown}
            />
            <button
              className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!inputValue.trim()}
            >
              Embed
            </button>
            {url && (
              <button
                className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300 transition-colors"
                onClick={() => { setInputValue(url); setIsEditing(false); setError(false) }}
              >
                Cancel
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-500">Invalid YouTube URL</p>}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group">
        <div className={`rounded overflow-hidden ${selected ? 'ring-2 ring-blue-500' : ''}`}>
          <iframe
            className="w-full aspect-video"
            src={`https://www.youtube.com/embed/${videoId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default YoutubeEmbedComponent
