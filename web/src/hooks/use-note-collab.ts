import { useEffect, useRef, useState, useCallback } from 'react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import * as Y from 'yjs'

interface UseNoteCollabOptions {
  noteId: string
  workspaceId: string
  enabled: boolean
}

export interface NoteRoom {
  yDoc: Y.Doc
  provider: HocuspocusProvider
}

/**
 * Hocuspocus room of a note. Layout (see collab/src/notes/note-doc.js):
 * `blocks` holds one entry per editor block, `meta` the title and root block order.
 */
export function useNoteCollab(options: UseNoteCollabOptions) {
  const { noteId, workspaceId, enabled } = options

  const roomRef = useRef<NoteRoom | null>(null)
  const [room, setRoom] = useState<NoteRoom | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!enabled || !noteId || !workspaceId) return

    const yDoc = new Y.Doc()
    const yMeta = yDoc.getMap('meta')

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/notes/${noteId}`

    const provider = new HocuspocusProvider({
      url,
      name: `note:${noteId}`,
      document: yDoc,
      onConnect() {
        setIsConnected(true)
      },
      onDisconnect() {
        setIsConnected(false)
      },
      onSynced() {
        setIsSynced(true)
      },
    })

    const next = { yDoc, provider }
    roomRef.current = next
    setRoom(next)

    const metaObserver = () => {
      const newTitle = yMeta.get('title')
      if (newTitle !== undefined) setTitle(newTitle as string)
    }
    yMeta.observe(metaObserver)
    metaObserver()

    return () => {
      yMeta.unobserve(metaObserver)
      provider.destroy()
      yDoc.destroy()
      roomRef.current = null
      setRoom(null)
      setIsConnected(false)
      setIsSynced(false)
      setTitle('')
    }
  }, [noteId, workspaceId, enabled])

  const sendUpdateTitle = useCallback((newTitle: string) => {
    const r = roomRef.current
    if (r) r.yDoc.getMap('meta').set('title', newTitle)
    setTitle(newTitle)
  }, [])

  return {
    isConnected,
    isSynced,
    // Synced once is enough: after a reconnect the room catches up through normal updates.
    isReady: isSynced,
    title,
    sendUpdateTitle,
    room,
  }
}
