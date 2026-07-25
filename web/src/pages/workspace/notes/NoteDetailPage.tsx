import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useEffect, useRef, useState } from "react"
import { MessageCircle } from "lucide-react"
import { getNote, NoteData } from "@/api/note"
import NoteDetailView from "@/components/notedetail/NoteDetailView"
import { useNoteCollab } from "@/hooks/use-note-collab"
import NoteDetailMenu from "@/components/notedetailmenu/NoteDetailMenu"
import CommentSidebar from "@/components/commentsidebar/CommentSidebar"
import { setLastNoteId } from "@/lib/recent-visits"

const NoteDetailPage = () => {
    const [note, setNote] = useState<NoteData | null>(null)
    const [showComments, setShowComments] = useState(false)
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { noteId } = useParams()
    const queryClient = useQueryClient()

    // Connect to Hocuspocus for real-time collaboration
    const {
        isReady,
        title: wsTitle,
        sendUpdateTitle,
        yDoc,
        yText
    } = useNoteCollab({
        noteId: noteId || '',
        workspaceId: currentWorkspaceId || '',
        enabled: !!noteId && !!currentWorkspaceId
    })

    // Always fetch note metadata from REST API
    // gcTime: 0 ensures stale content is not shown when navigating back to a note,
    // since content is the source of truth in Y.js (not the REST API snapshot).
    const { data: fetchedNote } = useQuery({
        queryKey: ['note', currentWorkspaceId, noteId],
        queryFn: () => getNote(currentWorkspaceId, noteId!),
        enabled: !!noteId && !!currentWorkspaceId,
        gcTime: 0,
    })

    // Reset note when navigating to a different note to avoid showing stale content
    useEffect(() => {
        setNote(null)
    }, [noteId])

    useEffect(() => {
        if (noteId && currentWorkspaceId) setLastNoteId(currentWorkspaceId, noteId)
    }, [noteId, currentWorkspaceId])

    useEffect(() => {
        if (fetchedNote) {
            setNote(fetchedNote)
        }
    }, [fetchedNote])

    // Track current noteId in a ref so the wsTitle sync effect can read it
    // without taking noteId as a dependency (prevents stale-title cross-note pollution)
    const noteIdRef = useRef(noteId ?? '')
    useEffect(() => {
        noteIdRef.current = noteId ?? ''
    }, [noteId])

    // Sync WebSocket title changes back into React Query cache.
    // noteId is intentionally read from a ref (not a dep) so this effect only fires
    // when wsTitle itself changes — not when noteId changes. Without this, navigating
    // away from a titled note would momentarily write the old title into the new note's
    // cache entry before the WS cleanup resets wsTitle to ''.
    useEffect(() => {
        if (!isReady || !currentWorkspaceId) return
        const currentNoteId = noteIdRef.current
        if (!currentNoteId) return

        queryClient.setQueryData(['note', currentWorkspaceId, currentNoteId], (old: NoteData | undefined) => {
            if (!old) return old
            return { ...old, title: wsTitle }
        })

        queryClient.setQueriesData(
            { queryKey: ['notes', currentWorkspaceId], exact: false },
            (old: any) => {
                if (!old?.pages) return old
                return {
                    ...old,
                    pages: old.pages.map((page: NoteData[]) =>
                        page.map((n: NoteData) => n.id === currentNoteId ? { ...n, title: wsTitle } : n)
                    )
                }
            }
        )
    }, [wsTitle, currentWorkspaceId, queryClient])

    return (
        <div className="flex bg-white dark:bg-neutral-800 xl:w-full h-full min-w-0">
            <NoteDetailView
                note={note}
                menu={note ? (
                    <div className="flex items-center gap-1">
                        <button
                            className={`p-2 rounded ${showComments ? 'text-primary' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-100 dark:hover:bg-neutral-700`}
                            onClick={() => setShowComments(prev => !prev)}
                        >
                            <MessageCircle size={16} />
                        </button>
                        <NoteDetailMenu note={note} />
                    </div>
                ) : undefined}
                wsTitle={wsTitle}
                wsReady={isReady}
                onTitleChange={sendUpdateTitle}
                yDoc={yDoc}
                yText={yText}
            />
            {currentWorkspaceId && noteId && (
                <CommentSidebar
                    workspaceId={currentWorkspaceId}
                    noteId={noteId}
                    open={showComments}
                    onOpenChange={setShowComments}
                />
            )}
        </div>
    )
}

export default NoteDetailPage
