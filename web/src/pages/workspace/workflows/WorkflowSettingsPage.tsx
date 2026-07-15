import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkspaceMembers } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import OneColumn from "@/components/onecolumn/OneColumn"
import WorkflowVarsSecretsSection from "./WorkflowVarsSecretsSection"
import WorkflowFilesSection from "./WorkflowFilesSection"
import ConnectedRunnersSection from "./ConnectedRunnersSection"

// Dedicated settings page for workflow-wide configuration (variables,
// secrets, codebase files, connected runners) - previously lived in
// workspace Settings, split out here since it's specific to workflow
// authoring rather than the workspace as a whole.
const WorkflowSettingsPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { t } = useTranslation()
    const { user: currentUser } = useCurrentUserStore()

    const { data: members = [] } = useQuery({
        queryKey: ['workspaceMembers', currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId
    })

    const currentMember = members.find(m => m.user_id === currentUser?.id)
    const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin'
    // Runners are instance-wide, so visibility follows the current user's
    // instance role rather than their role within this workspace.
    const isInstanceOwnerOrAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin'

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10 min-w-0">
                        <Link to=".." relative="path" className="hover:underline shrink-0">
                            {t("pages.workflows.title")}
                        </Link>
                        <span className="opacity-40 shrink-0">/</span>
                        <span className="truncate">{t("pages.workflows.settingsTitle")}</span>
                    </div>
                </div>

                <div className="grow flex justify-start pb-5">
                    <div className="flex-1">
                        <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full p-5 max-w-3xl">
                            {isOwnerOrAdmin || isInstanceOwnerOrAdmin ? (
                                <div className="flex flex-col gap-6">
                                    {isOwnerOrAdmin && (
                                        <>
                                            <WorkflowVarsSecretsSection />
                                            <WorkflowFilesSection />
                                        </>
                                    )}
                                    <ConnectedRunnersSection />
                                </div>
                            ) : (
                                <div className="text-sm text-gray-400 dark:text-gray-500">
                                    {t("pages.workflows.settingsNoAccess")}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </OneColumn>
}

export default WorkflowSettingsPage
