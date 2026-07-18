import { useNavigate, useParams } from "react-router-dom"
import { useEffect } from "react"
import { useWorkspaceStore } from "@/stores/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { getLastWorkspaceId } from "@/lib/recent-visits"

const WorkspaceLoader = () => {
    const { isFetched, workspaces, fetchWorkspaces } = useWorkspaceStore()
    const { user } = useCurrentUserStore()
    const { workspaceId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        (async () => {
            if (!user) navigate("/signin")
            await fetchWorkspaces();
        })();
    }, [])

    useEffect(() => {
        if (!isFetched) return

        if (workspaces.length == 0) {
            navigate("/workspace-setup", { replace: true })
        }
        else if (!workspaceId && workspaces?.length > 0) {
            const lastWorkspaceId = getLastWorkspaceId()
            const targetWorkspace = workspaces.find(w => w.id === lastWorkspaceId) ?? workspaces[0]
            navigate(`/workspaces/${targetWorkspace.id}`, { replace: true })
        }
    }, [workspaces])

    return <></>
}

export default WorkspaceLoader