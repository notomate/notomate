import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { signOut } from "@/api/auth"
import { useCurrentUserStore } from "@/stores/current-user"
import { useWorkspaceStore } from "@/stores/workspace"

/** Signs the user out, clears the cached user and workspaces, and goes home. */
export default function useSignOut() {
    const navigate = useNavigate()
    const { resetCurrentUser } = useCurrentUserStore()
    const { resetWorkspaces } = useWorkspaceStore()

    return useMutation({
        mutationFn: () => signOut(),
        onSuccess: () => {
            resetWorkspaces()
            resetCurrentUser()
            navigate("/")
        },
    })
}
