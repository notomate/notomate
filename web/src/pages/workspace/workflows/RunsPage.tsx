import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkflow, getWorkflowRuns } from "@/api/workflow"
import OneColumn from "@/components/onecolumn/OneColumn"
import StatusBadge from "./StatusBadge"

const RunsPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { workflowId } = useParams()
    const { t } = useTranslation()

    const { data: workflow } = useQuery({
        queryKey: ['workflow', currentWorkspaceId, workflowId],
        queryFn: () => getWorkflow(currentWorkspaceId, workflowId!),
        enabled: !!currentWorkspaceId && !!workflowId
    })

    const { data: runs = [] } = useQuery({
        queryKey: ['workflowRuns', currentWorkspaceId, workflowId],
        queryFn: () => getWorkflowRuns(currentWorkspaceId, workflowId!),
        enabled: !!currentWorkspaceId && !!workflowId,
        refetchInterval: (query) =>
            query.state.data?.some(r => r.status === 'queued' || r.status === 'running') ? 3000 : false
    })

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center gap-3 sm:text-xl font-semibold h-14 min-w-0">
                    <Link to="../.." relative="path" className="hover:underline shrink-0">
                        {t("pages.workflows.title")}
                    </Link>
                    <span className="opacity-40 shrink-0">/</span>
                    <Link to=".." relative="path" className="hover:underline truncate">
                        {workflow?.name}
                    </Link>
                    <span className="opacity-40 shrink-0">/</span>
                    <span className="shrink-0">{t("pages.workflows.runs")}</span>
                </div>
                <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full max-w-3xl">
                    {runs.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
                            {t("pages.workflows.noRuns")}
                        </div>
                    ) : (
                        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                            {runs.map(run => (
                                <Link
                                    key={run.id}
                                    to={run.id}
                                    className="flex items-center gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                                >
                                    <span className="font-mono text-sm text-gray-400 dark:text-gray-500 w-12 shrink-0">
                                        #{run.run_number}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <StatusBadge status={run.status} />
                                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                            {run.event} · {new Date(run.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    </OneColumn>
}

export default RunsPage
