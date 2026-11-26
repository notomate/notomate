import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { createNote, NoteData } from "@/api/note"
import { toast } from "@/stores/toast"
import useCurrentWorkspaceId from "./use-currentworkspace-id"

export default function useCreateNote() {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const createNoteMutation = useMutation({
        mutationFn: (data: NoteData) => createNote(currentWorkspaceId, data),
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
        const emptyContent = JSON.stringify({
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }]
        })
        createNoteMutation.mutate({ content: emptyContent, visibility: "private" })
    }

    return { handleCreateNote, isPending: createNoteMutation.isPending }
}
