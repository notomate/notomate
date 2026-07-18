import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "react-router-dom"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useEffect, useRef, useState } from "react"
import { getNote, NoteData, updateNote } from "@/api/note"
import NoteDetailView from "@/components/notedetail/NoteDetailView"
import { useNoteCollab } from "@/hooks/use-note-collab"
import NoteDetailMenu from "@/components/notedetailmenu/NoteDetailMenu"
import { setLastNoteId } from "@/lib/recent-visits"

const NoteDetailPage = () => {
    const [note, setNote] = useState<NoteData | null>(null)
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { noteId } = useParams()
    const queryClient = useQueryClient()

    // Refs to always capture latest values for use in effect cleanups
    const latestContentRef = useRef<string>('')
    const saveContextRef = useRef<{ noteId: string; workspaceId: string; note: NoteData } | null>(null)

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

    // Keep saveContextRef up to date for use in cleanup
    useEffect(() => {
        if (note?.id && noteId && currentWorkspaceId) {
            saveContextRef.current = { noteId, workspaceId: currentWorkspaceId, note }
        }
    }, [note, noteId, currentWorkspaceId])

    // Track current noteId in a ref so the wsTitle sync effect can read it
    // without taking noteId as a dependency (prevents stale-title cross-note pollution)
    const noteIdRef = useRef(noteId ?? '')
    useEffect(() => {
        noteIdRef.current = noteId ?? ''
    }, [noteId])

    // Observe Y.js content changes and track the latest value in a ref.
    // This allows the cleanup to read the most recent content even after the Y.Doc is destroyed.
    useEffect(() => {
        if (!yText) return
        const initial = yText.get('data') as string
        if (initial) latestContentRef.current = initial
        const observer = () => {
            const content = yText.get('data') as string
            if (content) latestContentRef.current = content
        }
        yText.observe(observer)
        return () => yText.unobserve(observer)
    }, [yText])

    // Save current Y.js content to REST API when navigating away (noteId change or unmount).
    // This ensures the DB is always up to date before Hocuspocus's debounced onStoreDocument fires,
    // preventing stale content from being shown on the next visit.
    useEffect(() => {
        // Reset so stale content from the previous note is never saved under this noteId.
        // The cleanup below runs first (saving the old note), then this reset runs.
        const capturedNoteId = noteId ?? ''
        latestContentRef.current = ''
        return () => {
            const content = latestContentRef.current
            const ctx = saveContextRef.current
            // Guard: only save if saveContextRef still points to the note we set up for.
            // Prevents a race where the REST API updates saveContextRef to note B before
            // Y.js syncs, causing latestContent (still note A) to overwrite note B.
            if (content && ctx && ctx.noteId === capturedNoteId) {
                updateNote(ctx.workspaceId, { ...ctx.note, id: ctx.noteId, content })
                    .catch(console.error)
            }
        }
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
        <div className="flex flex-col bg-white dark:bg-neutral-800 xl:w-full h-full">
            <NoteDetailView
                note={note}
                menu={note ? <NoteDetailMenu note={note} /> : undefined}
                wsTitle={wsTitle}
                wsReady={isReady}
                onTitleChange={sendUpdateTitle}
                yDoc={yDoc}
                yText={yText}
            />
        </div>
    )
}

export default NoteDetailPage
