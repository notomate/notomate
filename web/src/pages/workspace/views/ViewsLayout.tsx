import { useTranslation } from "react-i18next"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Outlet } from "react-router-dom"
import { useState } from "react"
import { useWorkspaceStore } from "@/stores/workspace"
import WorkspaceSidebar from "@/components/workspacesidebar/WorkspaceSidebar"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"

const ViewsLayout = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()
    const currentWorkspaceName = getWorkspaceById(currentWorkspaceId)?.name

    return (
        <div className="flex h-svh">
            <WorkspaceSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <MobileTopBar
                    title={currentWorkspaceName ?? t("menu.notes")}
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                />
                <div className="flex-1 overflow-hidden">
                    <Outlet />
                </div>
            </div>

        </div>
    )
}

export default ViewsLayout
