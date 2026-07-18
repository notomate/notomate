import { Edit, FileText } from "lucide-react"
import { useTranslation } from "react-i18next"
import { getNotes, getNote, NoteData, createNote } from "@/api/note"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useEffect } from "react"
import { toast } from "@/stores/toast"
import { getLastNoteId, clearLastNoteId } from "@/lib/recent-visits"

const NotesPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId();
    const { t } = useTranslation()
    const navigate = useNavigate();
    const lastNoteId = getLastNoteId(currentWorkspaceId)

    const createNoteMutation = useMutation({
        mutationFn: (data: NoteData) => createNote(currentWorkspaceId, data),
        onSuccess: (data) => {
            navigate(`./${data.id}?mode=edit`)
        },
        onError: (error) => {
            toast.error(t("messages.createNoteFailed"))
            console.error("Failed to create note:", error)
        }
    })

    const handleCreateNote = () => {
        const emptyContent = JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }]
        })
        createNoteMutation.mutate({ content: emptyContent, visibility: "private" })
    }

    const { data: lastVisitedNote, isLoading: isLastVisitedLoading, isError: isLastVisitedError } = useQuery({
        queryKey: ['note', currentWorkspaceId, lastNoteId, 'last-visited'],
        queryFn: () => getNote(currentWorkspaceId, lastNoteId!),
        enabled: !!currentWorkspaceId && !!lastNoteId,
        retry: false,
        staleTime: 0,
    })

    useEffect(() => {
        if (isLastVisitedError && lastNoteId) clearLastNoteId(currentWorkspaceId)
    }, [isLastVisitedError, lastNoteId, currentWorkspaceId])

    const shouldUseLastEdited = !lastNoteId || isLastVisitedError

    const { data: notes, isLoading: isLastEditedLoading } = useQuery({
        queryKey: ['notes', currentWorkspaceId, 'last-edited'],
        queryFn: () => getNotes(currentWorkspaceId, 1, 1, "", "updated_at"),
        enabled: !!currentWorkspaceId && shouldUseLastEdited,
        refetchOnWindowFocus: false,
        staleTime: 0,
    })

    const isLoading = shouldUseLastEdited ? isLastEditedLoading : isLastVisitedLoading
    const lastNote: NoteData | undefined = lastVisitedNote ?? notes?.[0]

    useEffect(() => {
        if (!isLoading && lastNote?.id) {
            navigate(`./${lastNote.id}`, { replace: true })
        }
    }, [isLoading, lastNote, navigate])

    if (isLoading) {
        return <div className="h-full bg-neutral-50 dark:bg-neutral-950" />
    }

    if (lastNote) {
        return null
    }

    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 bg-neutral-50 dark:bg-neutral-950">
            <FileText size={48} className="text-gray-200 dark:text-neutral-700 mb-4" />
            <p className="text-gray-400 dark:text-neutral-500 text-sm mb-6">
                {t("messages.noMoreNotes")}
            </p>
            <button
                onClick={handleCreateNote}
                disabled={createNoteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                <Edit size={15} />
                {t("actions.newNote")}
            </button>
        </div>
    )
}

export default NotesPage
