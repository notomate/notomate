import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { createNote, NoteData } from "@/api/note"
import { toast } from "@/stores/toast"

/** Creates a note in `workspaceId`, or in the workspace in the URL when it is omitted. */
export default function useCreateNote(workspaceId?: string) {
    const params = useParams<{ workspaceId?: string }>()
    const currentWorkspaceId = workspaceId ?? params.workspaceId
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const createNoteMutation = useMutation({
        mutationFn: (data: NoteData) => createNote(currentWorkspaceId!, data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['notes', currentWorkspaceId] })
            navigate(`/workspaces/${currentWorkspaceId}/notes/${data.id}?mode=edit`)
        },
        onError: (error) => {
            toast.error(t("messages.createNoteFailed"))
            console.error("Failed to create note:", error)
        }
    })

    const handleCreateNote = () => {
        if (!currentWorkspaceId) return
        const emptyContent = JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }]
        })
        createNoteMutation.mutate({ content: emptyContent, visibility: "private" })
    }

    return { handleCreateNote, isPending: createNoteMutation.isPending }
}
