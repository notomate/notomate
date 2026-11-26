import { useTranslation } from "react-i18next"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useWorkspaceStore } from "@/stores/workspace"
import MobileTopBar from "@/components/mobiletopbar/MobileTopBar"
import { useAppLayout } from "@/components/applayout/AppLayout"

/** Mobile top bar for workspace pages, titled with the workspace name. */
const WorkspaceHeader = () => {
    const workspaceId = useCurrentWorkspaceId()
    const { onOpenSidebar } = useAppLayout()
    const { t } = useTranslation()
    const { getWorkspaceById } = useWorkspaceStore()

    return (
        <MobileTopBar
            title={getWorkspaceById(workspaceId)?.name ?? t("menu.workspace")}
            onOpenSidebar={onOpenSidebar}
        />
    )
}

export default WorkspaceHeader
