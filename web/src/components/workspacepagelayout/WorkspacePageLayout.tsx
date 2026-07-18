import { useTranslation } from "react-i18next"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Outlet, useLocation } from "react-router-dom"
import { useState } from "react"
import { Edit } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspace"
import useCreateNote from "@/hooks/use-create-note"
import WorkspaceSidebar from "@/components/workspacesidebar/WorkspaceSidebar"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"

const WorkspacePageLayout = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { t } = useTranslation()
    const location = useLocation()
    const { getWorkspaceById } = useWorkspaceStore()
    const currentWorkspaceName = getWorkspaceById(currentWorkspaceId)?.name
    const { handleCreateNote, isPending: isCreatingNote } = useCreateNote()

    const isSearchPage = location.pathname.endsWith('/search')

    return (
        <div className="flex h-svh">
            <WorkspaceSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <MobileTopBar
                    title={currentWorkspaceName ?? t("menu.notes")}
                    onOpenSidebar={() => setIsSidebarOpen(true)}
                    rightActions={isSearchPage ? (
                        <button
                            aria-label={t("actions.newNote")}
                            onClick={handleCreateNote}
                            disabled={isCreatingNote}
                            className="p-2 -mr-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400 disabled:opacity-50"
                        >
                            <Edit size={16} />
                        </button>
                    ) : undefined}
                />
                <div className="flex-1 overflow-hidden">
                    <Outlet />
                </div>
            </div>

        </div>
    )
}

export default WorkspacePageLayout
