import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2 } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

const TiktokIcon = () => (
  <svg height="18" width="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-current">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>
  </svg>
)

function extractTiktokVideoId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('tiktok.com')) {
      const match = parsed.pathname.match(/\/video\/(\d+)/)
      return match?.[1] ?? null
    }
  } catch {
    // invalid URL
  }
  return null
}

function isValidTiktokUrl(url: string): boolean {
  return extractTiktokVideoId(url) !== null
}

const TiktokEmbedComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const { url } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [isEditing, setIsEditing] = useState(!url)
  const [inputValue, setInputValue] = useState(url ?? '')
  const [error, setError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isEditing])

  useEffect(() => {
    if (!url || !containerRef.current) return
    const videoId = extractTiktokVideoId(url)
    if (!videoId) return

    const container = containerRef.current
    container.innerHTML = ''

    const blockquote = document.createElement('blockquote')
    blockquote.className = 'tiktok-embed'
    blockquote.setAttribute('cite', url)
    blockquote.setAttribute('data-video-id', videoId)
    blockquote.style.cssText = 'max-width:605px;min-width:325px;'
    const section = document.createElement('section')
    blockquote.appendChild(section)
    container.appendChild(blockquote)

    const existing = document.getElementById('tiktok-embed-js')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id = 'tiktok-embed-js'
    script.src = 'https://www.tiktok.com/embed.js'
    script.async = true
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [url])

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!isValidTiktokUrl(trimmed)) {
      setError(true)
      return
    }
    setError(false)
    updateAttributes({ url: trimmed })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape' && url) {
      setInputValue(url)
      setIsEditing(false)
      setError(false)
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

  if (isEditing || !url) {
    return (
      <NodeViewWrapper className="tiktok-embed-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TiktokIcon />
            <span className="text-sm font-medium">TikTok Embed</span>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 px-3 py-2 text-sm rounded border ${error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-neutral-600'} bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Paste TikTok video URL..."
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
          {error && <p className="text-xs text-red-500">Invalid TikTok URL (e.g. https://www.tiktok.com/@username/video/1234567890)</p>}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group">
        <div ref={containerRef} className={selected ? 'ring-2 ring-blue-500 rounded' : ''} />
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default TiktokEmbedComponent
