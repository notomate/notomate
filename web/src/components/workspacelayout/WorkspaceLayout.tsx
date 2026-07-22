import { useEffect, useState } from "react"
import { useParams, Outlet } from "react-router-dom"
import { useWorkspaceStore } from "@/stores/workspace"
import { setLastWorkspaceId } from "@/lib/recent-visits"
import WorkspaceSidebar from "@/components/workspacesidebar/WorkspaceSidebar"

export interface WorkspaceLayoutContext {
    onOpenSidebar: () => void
}

const WorkspaceLayout = () => {
    const { isFetched, fetchWorkspaces } = useWorkspaceStore()
    const { workspaceId } = useParams<{ workspaceId?: string }>()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        (async () => {
            if (isFetched) return;
            await fetchWorkspaces();
        })()
    }, [])

    useEffect(() => {
        if (workspaceId) setLastWorkspaceId(workspaceId)
    }, [workspaceId])

    return (
        <div className="flex h-svh">
            <WorkspaceSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Outlet context={{ onOpenSidebar: () => setIsSidebarOpen(true) } satisfies WorkspaceLayoutContext} />
            </div>
        </div>
    )
}

export default WorkspaceLayout
