import { FC, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { collaboration, Editor, presence, setHtml, useEditor } from '@notomate/editor'
import '@notomate/editor/style.css'
import './note-editor.css'
import type { NoteRoom } from '@/hooks/use-note-collab'
import { useCurrentUserStore } from '@/stores/current-user'
import { useGoogleMapsStatus } from '@/hooks/use-google-maps'
import { getWorkspaceMembers, type WorkspaceMember } from '@/api/workspace'
import { createNote } from '@/api/note'
import { listFiles, uploadFile } from '@/api/file'
import { createView, deleteView } from '@/api/view'
import { startPendingImageUpload } from '@/components/editor/extensions/imagenode/pendingImages'
import { noteBlocks } from './blocks'
import { editorMessages } from './messages'
import { NodeOptionsContext, type NodeOptions } from './nodeView'
import { mentionPlugin, pastePlugin } from './plugins'
import { awarenessPresence, docFromRoom, presenceUser, yjsSync } from './transports'

/** Fired on the document when a comment highlight is clicked (the sidebar opens its thread). */
export const COMMENT_CLICK_EVENT = 'note-comment-click'
/** Fired by the sidebar when a thread is deleted: its highlights are removed. */
export const COMMENT_MARK_REMOVE_EVENT = 'note-comment-mark-remove'

interface Props {
  /** A synced note room; mount with `key={noteId}`. */
  room: NoteRoom
  workspaceId: string
  noteId: string
}

/** Unwrap one thread's comment highlights in every block that has them. */
function removeCommentMarks(threadId: string) {
  const { blocks } = useEditor.getState().doc
  const marker = `data-comment-thread-id="${threadId}"`
  for (const b of Object.values(blocks)) {
    if (!b.html.includes(marker)) continue
    const tpl = document.createElement('template')
    tpl.innerHTML = b.html
    tpl.content.querySelectorAll(`[data-comment-thread-id="${CSS.escape(threadId)}"]`).forEach((el) => el.replaceWith(...el.childNodes))
    setHtml(b.id, tpl.innerHTML)
  }
}

/** Block editor for a note, synced and shared through the note's Hocuspocus room. */
const NoteEditor: FC<Props> = ({ room, workspaceId, noteId }) => {
  const { t } = useTranslation()
  const user = useCurrentUserStore((s) => s.user)

  // Plugins and blocks are read once on mount; they reach live data through refs.
  const { data: members = [] } = useQuery({
    queryKey: ['workspaceMembers', workspaceId],
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: !!workspaceId,
  })
  const membersRef = useRef<WorkspaceMember[]>(members)
  membersRef.current = members
  const { data: googleMapsStatus } = useGoogleMapsStatus(workspaceId)
  const googleMapsRef = useRef(false)
  googleMapsRef.current = !!googleMapsStatus?.configured

  const options = useMemo<NodeOptions>(
    () => ({
      workspaceId,
      noteId,
      // New sub-pages are children of this note.
      parentNoteId: noteId,
      upload: async (file, onProgress) => {
        const res = await uploadFile(workspaceId, file, onProgress)
        return { src: `/api/v1/workspaces/${workspaceId}/files/${res.filename}`, name: res.original_name }
      },
      listFiles,
      createNote,
      createView,
      deleteView,
    }),
    [workspaceId, noteId],
  )

  const setup = useMemo(
    () => ({
      defaultDoc: docFromRoom(room.yDoc),
      blocks: noteBlocks(t, { googleMapsEnabled: () => googleMapsRef.current }),
      plugins: [
        collaboration({ transport: yjsSync(room.yDoc) }),
        presence({
          transport: awarenessPresence(room.provider),
          user: presenceUser(room.provider, user ? { id: user.id, name: user.name } : null),
          bar: false,
        }),
        pastePlugin((file) => startPendingImageUpload(workspaceId, file)),
        mentionPlugin(() => membersRef.current),
      ],
      messages: editorMessages(t),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room],
  )

  useEffect(() => {
    const onRemove = (e: Event) => {
      const threadId = (e as CustomEvent<{ threadId?: string }>).detail?.threadId
      if (threadId) removeCommentMarks(threadId)
    }
    document.addEventListener(COMMENT_MARK_REMOVE_EVENT, onRemove)
    return () => document.removeEventListener(COMMENT_MARK_REMOVE_EVENT, onRemove)
  }, [])

  return (
    <NodeOptionsContext.Provider value={options}>
      <div
        onClick={(e) => {
          const threadId = (e.target as HTMLElement).closest('[data-comment-thread-id]')?.getAttribute('data-comment-thread-id')
          if (threadId) document.dispatchEvent(new CustomEvent(COMMENT_CLICK_EVENT, { detail: { threadId } }))
        }}
      >
        <Editor {...setup} showTitle={false} className="note-editor" compactWidth={1024} />
      </div>
    </NodeOptionsContext.Provider>
  )
}

export default NoteEditor
