import { useTranslation } from "react-i18next"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Plus, Workflow as WorkflowIcon, History } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkflows, updateWorkflowEnabled, WorkflowData } from "@/api/workflow"
import { getWorkspaceMembers } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { toast } from "@/stores/toast"
import OneColumn from "@/components/onecolumn/OneColumn"

const WorkflowsPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { user: currentUser } = useCurrentUserStore()

    const { data: workflows = [], refetch } = useQuery({
        queryKey: ['workflows', currentWorkspaceId],
        queryFn: () => getWorkflows(currentWorkspaceId),
        enabled: !!currentWorkspaceId
    })

    const { data: members = [] } = useQuery({
        queryKey: ['workspaceMembers', currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId
    })
    const currentMember = members.find(m => m.user_id === currentUser?.id)
    const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin'

    const toggleEnabledMutation = useMutation({
        mutationFn: (wf: WorkflowData) => updateWorkflowEnabled(currentWorkspaceId, wf.id, !wf.enabled),
        onSuccess: () => refetch(),
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to update workflow")
        }
    })

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center justify-between">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10">
                        {t("pages.workflows.title")}
                    </div>
                    {isOwnerOrAdmin && (
                        <button
                            onClick={() => navigate("new")}
                            className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                        >
                            <Plus size={16} />
                            {t("pages.workflows.newWorkflow")}
                        </button>
                    )}
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full max-w-3xl">
                    {workflows.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                            {t("pages.workflows.noWorkflows")}
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                            {workflows.map(wf => (
                                <div key={wf.id} className="flex items-center gap-3 p-4">
                                    <WorkflowIcon size={18} className="shrink-0 opacity-50" />
                                    <div className="flex-1 min-w-0">
                                        <Link to={wf.id} className="font-medium hover:underline truncate block">
                                            {wf.name}
                                        </Link>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            {wf.enabled ? t("pages.workflows.enabled") : t("pages.workflows.disabled")}
                                        </div>
                                    </div>
                                    <Link
                                        to={`${wf.id}/runs`}
                                        className="p-2 flex gap-1.5 items-center text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                                    >
                                        <History size={15} />
                                        {t("pages.workflows.runs")}
                                    </Link>
                                    {isOwnerOrAdmin && (
                                        <button
                                            role="switch"
                                            aria-checked={wf.enabled}
                                            onClick={() => toggleEnabledMutation.mutate(wf)}
                                            disabled={toggleEnabledMutation.isPending}
                                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${wf.enabled ? "bg-blue-500" : "bg-neutral-300 dark:bg-neutral-600"}`}
                                        >
                                            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${wf.enabled ? "translate-x-4.5" : "translate-x-0.5"}`} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </OneColumn>
}

export default WorkflowsPage
