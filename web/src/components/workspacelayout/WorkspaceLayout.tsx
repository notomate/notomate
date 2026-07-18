import { useEffect } from "react"
import { useParams, Outlet } from "react-router-dom"
import { useWorkspaceStore } from "@/stores/workspace"
import { setLastWorkspaceId } from "@/lib/recent-visits"

const WorkspaceLayout = () => {
    const { isFetched, fetchWorkspaces } = useWorkspaceStore()
    const { workspaceId } = useParams<{ workspaceId?: string }>()

    useEffect(() => {
        (async () => {
            if (isFetched) return;
            await fetchWorkspaces();
        })()
    }, [])

    useEffect(() => {
        if (workspaceId) setLastWorkspaceId(workspaceId)
    }, [workspaceId])

    return <Outlet />
}

export default WorkspaceLayout
