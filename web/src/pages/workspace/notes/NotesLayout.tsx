import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Link, Outlet } from "react-router-dom"
import { useState } from "react"
import { useWorkspaceStore } from "@/stores/workspace"
import WorkspaceSidebar from "@/components/workspacesidebar/WorkspaceSidebar"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"

const NotesLayout = () => {
    const currentWorkspaceId = useCurrentWorkspaceId();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
                    rightActions={
                        <Link
                            to={`/workspaces/${currentWorkspaceId}/notes/search`}
                            aria-label={t("placeholder.search")}
                            className="p-2 -mr-2 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400"
                        >
                            <Search size={16} />
                        </Link>
                    }
                />
                <div className="flex-1 overflow-hidden">
                    <Outlet />
                </div>
            </div>

        </div>
    )
}

export default NotesLayout
