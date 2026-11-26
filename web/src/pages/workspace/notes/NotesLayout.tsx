import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { Link, Outlet } from "react-router-dom"
import { useWorkspaceStore } from "@/stores/workspace"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"

const NotesLayout = () => {
    const currentWorkspaceId = useCurrentWorkspaceId();
    const { onOpenSidebar } = useAppLayout()
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()
    const currentWorkspaceName = getWorkspaceById(currentWorkspaceId)?.name

    return (
        <>
            <MobileTopBar
                title={currentWorkspaceName ?? t("menu.notes")}
                onOpenSidebar={onOpenSidebar}
                rightActions={
                    <Link
                        to={`/workspaces/${currentWorkspaceId}/notes/search`}
                        aria-label={t("placeholder.search")}
                        className="p-2 -mr-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-muted-foreground"
                    >
                        <Search size={16} />
                    </Link>
                }
            />
            <div className="flex-1 overflow-hidden">
                <Outlet />
            </div>
        </>
    )
}

export default NotesLayout
