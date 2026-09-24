import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2 } from "lucide-react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

// Instagram SVG logo icon
const InstagramIcon = () => (
  <svg height="18" width="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="fill-current">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
)

function extractInstagramPostId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('instagram.com')) {
      const match = parsed.pathname.match(/\/(p|reel|tv)\/([^/?#]+)/)
      return match?.[2] ?? null
    }
  } catch {
    // invalid URL
  }
  return null
}

function isValidInstagramUrl(url: string): boolean {
  return extractInstagramPostId(url) !== null
}

const InstagramEmbedComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
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

  // Inject blockquote + embed script whenever url changes
  useEffect(() => {
    if (!url || !containerRef.current) return
    const postId = extractInstagramPostId(url)
    if (!postId) return

    const container = containerRef.current
    container.innerHTML = ''

    const blockquote = document.createElement('blockquote')
    blockquote.className = 'instagram-media'
    blockquote.setAttribute('data-instgrm-captioned', '')
    blockquote.setAttribute('data-instgrm-permalink', url)
    blockquote.setAttribute('data-instgrm-version', '14')
    blockquote.style.cssText = 'background:#FFF;border:0;border-radius:3px;box-shadow:0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15);margin:1px;max-width:540px;min-width:326px;padding:0;width:99.375%'
    container.appendChild(blockquote)

    // Remove existing script and re-add to force re-processing
    const existing = document.getElementById('instagram-embed-js')
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.id = 'instagram-embed-js'
    script.src = 'https://www.instagram.com/embed.js'
    script.async = true
    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [url])

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!isValidInstagramUrl(trimmed)) {
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
      <NodeViewWrapper className="instagram-embed-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <InstagramIcon />
            <span className="text-sm font-medium">Instagram Embed</span>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 px-3 py-2 text-sm rounded border ${error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-neutral-600'} bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Paste Instagram post URL..."
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
          {error && <p className="text-xs text-red-500">Invalid Instagram URL (e.g. https://www.instagram.com/p/abc123/ or https://www.instagram.com/reel/abc123/)</p>}
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

export default InstagramEmbedComponent
