import { Link, useMatch } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Settings } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useWorkspaceStore } from "@/stores/workspace"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"

/**
 * Mobile top bar for workspace pages, titled with the workspace name. On the
 * workspace home it also links to the workspace settings.
 */
const WorkspaceHeader = () => {
    const workspaceId = useCurrentWorkspaceId()
    const { onOpenSidebar } = useAppLayout()
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()
    const isHome = !!useMatch("/workspaces/:workspaceId")

    return (
        <MobileTopBar
            title={getWorkspaceById(workspaceId)?.name ?? t("menu.workspace")}
            onOpenSidebar={onOpenSidebar}
            rightActions={isHome ? (
                <Link
                    to={`/workspaces/${workspaceId}/settings`}
                    title={t("menu.workspaceSettings")}
                    aria-label={t("menu.workspaceSettings")}
                    className="p-2 -mr-2 rounded-md text-muted-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                    <Settings size={16} />
                </Link>
            ) : undefined}
        />
    )
}

export default WorkspaceHeader
