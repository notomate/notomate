import { NodeViewProps, NodeViewWrapper } from "@tiptap/react"
import { ChevronUp, ChevronDown, Edit3, Trash2, LoaderCircle } from "lucide-react"
import { useState, useRef, useEffect, useCallback, useId } from "react"
import { useDragMenu, NodeTouchMenu } from "@/components/editor/DragMenuContext"

// Threads SVG logo icon
const ThreadsIcon = () => (
  <svg height="18" role="img" viewBox="0 0 192 192" width="18" xmlns="http://www.w3.org/2000/svg" className="fill-current">
    <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" />
  </svg>
)

function extractThreadsPostId(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('threads.com') || parsed.hostname.includes('threads.net')) {
      const match = parsed.pathname.match(/\/post\/([^/?#]+)/)
      return match?.[1] ?? null
    }
  } catch {
    // invalid URL
  }
  return null
}

function isValidThreadsUrl(url: string): boolean {
  return extractThreadsPostId(url) !== null
}

const ThreadsEmbedComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode, getPos }) => {
  const { url } = node.attrs
  const isEditable = editor.isEditable
  const isTouchDevice = window.matchMedia("(pointer: coarse)").matches
  const [isEditing, setIsEditing] = useState(!url)
  const [inputValue, setInputValue] = useState(url ?? '')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Unique per-instance suffix so two embeds of the same post don't share a
  // DOM id. The Threads SDK stores the blockquote id on its iframe and removes
  // that element by id on every resize message; a shared id makes one instance
  // delete another instance's blockquote before it renders.
  const instanceId = useId().replace(/:/g, '')

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isEditing])

  // (Re)build the blockquote and render it via the Threads SDK. Returns a
  // disposer that tears down the readiness watcher.
  const renderEmbed = useCallback((): (() => void) | void => {
    if (!url || !containerRef.current) return
    const postId = extractThreadsPostId(url)
    if (!postId) return

    const container = containerRef.current
    container.innerHTML = ''
    setLoading(true)

    const blockquote = document.createElement('blockquote')
    blockquote.className = 'text-post-media'
    blockquote.setAttribute('data-text-post-permalink', url)
    blockquote.setAttribute('data-text-post-version', '0')
    blockquote.id = `ig-tp-${postId}-${instanceId}`
    blockquote.style.cssText = 'background:#FFF;border-width:1px;border-style:solid;border-color:#00000026;border-radius:16px;max-width:650px;margin:1px;min-width:270px;padding:0;width:99.375%'
    container.appendChild(blockquote)

    // The Threads embed SDK registers into window.instgrm.Embeds and guards
    // against re-running on subsequent script injections. So on remount we must
    // reuse the already-loaded SDK and call process() to render the new
    // blockquote; only inject the script the first time it isn't present.
    const w = window as unknown as { instgrm?: { Embeds?: { process?: () => void } } }
    if (w.instgrm?.Embeds?.process) {
      w.instgrm.Embeds.process()
    } else if (!document.getElementById('threads-embed-js')) {
      const script = document.createElement('script')
      script.id = 'threads-embed-js'
      script.src = 'https://www.threads.com/embed.js'
      script.async = true
      document.body.appendChild(script)
    }

    // Hide the loading placeholder once the SDK has swapped the blockquote for
    // an iframe and given it a real (non-zero) height. Fall back to the
    // iframe's load event, and a safety timeout so it never sticks.
    let settled = false
    let timer = 0
    const observer = new MutationObserver(() => {
      const iframe = container.querySelector('iframe')
      if (!iframe) return
      if (!iframe.dataset.loadBound) {
        iframe.dataset.loadBound = '1'
        iframe.addEventListener('load', finish)
      }
      if (parseFloat(iframe.style.height || '0') > 0) finish()
    })
    const finish = () => {
      if (settled) return
      settled = true
      observer.disconnect()
      window.clearTimeout(timer)
      setLoading(false)
    }
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'height'] })
    timer = window.setTimeout(finish, 8000)

    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [url, instanceId])

  // Inject on mount/url change, and re-inject when the page is restored from
  // the bfcache (back/forward navigation), where the cross-origin Threads
  // iframe is blanked but React effects don't re-run.
  useEffect(() => {
    let dispose = renderEmbed()
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        dispose?.()
        dispose = renderEmbed()
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    const container = containerRef.current
    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      dispose?.()
      if (container) container.innerHTML = ''
    }
  }, [renderEmbed])

  const handleSubmit = () => {
    const trimmed = inputValue.trim()
    if (!isValidThreadsUrl(trimmed)) {
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
      <NodeViewWrapper className="threads-embed-node select-none border dark:border-neutral-700 rounded p-3 bg-gray-100 dark:bg-neutral-800">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <ThreadsIcon />
            <span className="text-sm font-medium">Threads Embed</span>
          </div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 px-3 py-2 text-sm rounded border ${error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-neutral-600'} bg-white dark:bg-neutral-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500`}
              placeholder="Paste Threads post URL..."
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
                className="px-3 py-2 text-sm rounded border border-gray-300 dark:border-neutral-600 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300 transition-colors"
                onClick={() => { setInputValue(url); setIsEditing(false); setError(false) }}
              >
                Cancel
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-500">Invalid Threads post URL (e.g. https://www.threads.com/@user/post/abc123)</p>}
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <div className="relative group">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 max-w-[650px] rounded-2xl border border-black/10 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-400 dark:text-gray-500">
            <ThreadsIcon />
            <LoaderCircle size={16} className="animate-spin" />
            <span className="text-sm">Loading Threads post…</span>
          </div>
        )}
        <div ref={containerRef} className={`${selected ? 'ring-2 ring-blue-500 rounded-2xl' : ''}${loading ? ' h-0 overflow-hidden' : ''}`} />
        {isTouchDevice && isEditable && (
          <NodeTouchMenu visible={selected} actions={nodeActions} />
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default ThreadsEmbedComponent
