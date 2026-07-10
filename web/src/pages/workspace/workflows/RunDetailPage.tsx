import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router-dom"
import { useQuery, useMutation } from "@tanstack/react-query"
import { CircleSlash } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkflow, getWorkflowRun, getWorkflowJobLogs, WorkflowJobData, WorkflowJobLogLine } from "@/api/workflow"
import { cancelWorkflowRun } from "@/api/runner"
import { getWorkspaceMembers } from "@/api/workspace"
import { useCurrentUserStore } from "@/stores/current-user"
import { toast } from "@/stores/toast"
import OneColumn from "@/components/onecolumn/OneColumn"
import StatusBadge from "./StatusBadge"

const JobLogs = ({ workspaceId, runId, job }: { workspaceId: string; runId: string; job: WorkflowJobData }) => {
    const [lines, setLines] = useState<WorkflowJobLogLine[]>([])
    const [finished, setFinished] = useState(false)
    const cursorRef = useRef(0)
    const preRef = useRef<HTMLPreElement>(null)

    useEffect(() => {
        // Reset when switching jobs.
        setLines([])
        setFinished(false)
        cursorRef.current = 0

        let stopped = false
        let timer: ReturnType<typeof setTimeout>

        const poll = async () => {
            try {
                const res = await getWorkflowJobLogs(workspaceId, runId, job.id, cursorRef.current)
                if (stopped) return
                if (res.lines.length > 0) {
                    cursorRef.current = res.next
                    setLines(prev => [...prev, ...res.lines])
                }
                if (res.finished && res.lines.length === 0) {
                    setFinished(true)
                    return
                }
            } catch {
                // transient; retry on next tick
            }
            if (!stopped) timer = setTimeout(poll, 2000)
        }
        poll()

        return () => { stopped = true; clearTimeout(timer) }
    }, [workspaceId, runId, job.id])

    useEffect(() => {
        preRef.current?.scrollTo({ top: preRef.current.scrollHeight })
    }, [lines])

    return (
        <pre
            ref={preRef}
            className="text-xs font-mono bg-neutral-950 text-neutral-200 rounded p-3 overflow-auto max-h-[480px] whitespace-pre-wrap break-all"
        >
            {lines.length === 0
                ? (finished ? "(no logs)" : "...")
                : lines.map(l => `${l.content}\n`).join("")}
        </pre>
    )
}

const RunDetailPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { workflowId, runId } = useParams()
    const { t } = useTranslation()
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

    const { data: workflow } = useQuery({
        queryKey: ['workflow', currentWorkspaceId, workflowId],
        queryFn: () => getWorkflow(currentWorkspaceId, workflowId!),
        enabled: !!currentWorkspaceId && !!workflowId
    })

    const { data: run, refetch: refetchRun } = useQuery({
        queryKey: ['workflowRun', currentWorkspaceId, runId],
        queryFn: () => getWorkflowRun(currentWorkspaceId, runId!),
        enabled: !!currentWorkspaceId && !!runId,
        refetchInterval: (query) => {
            const status = query.state.data?.status
            return status === 'queued' || status === 'running' ? 3000 : false
        }
    })

    const { user: currentUser } = useCurrentUserStore()
    const { data: members = [] } = useQuery({
        queryKey: ['workspaceMembers', currentWorkspaceId],
        queryFn: () => getWorkspaceMembers(currentWorkspaceId),
        enabled: !!currentWorkspaceId
    })
    const currentMember = members.find(m => m.user_id === currentUser?.id)
    const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin'

    const cancelMutation = useMutation({
        mutationFn: () => cancelWorkflowRun(currentWorkspaceId, runId!),
        onSuccess: () => {
            toast.success(t("pages.workflows.runCancelled"))
            refetchRun()
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.message || error?.message || "Failed to cancel run")
        }
    })

    const jobs = run?.jobs ?? []
    const selectedJob = jobs.find(j => j.id === selectedJobId) ?? jobs[0]

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center gap-3 sm:text-xl font-semibold h-14 min-w-0">
                    <Link to="../../.." relative="path" className="hover:underline shrink-0">
                        {t("pages.workflows.title")}
                    </Link>
                    <span className="opacity-40 shrink-0">/</span>
                    <Link to="../.." relative="path" className="hover:underline truncate">
                        {workflow?.name}
                    </Link>
                    <span className="opacity-40 shrink-0">/</span>
                    <span className="shrink-0">#{run?.run_number}</span>
                </div>

                <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full max-w-4xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-4 flex-wrap">
                        {run && <StatusBadge status={run.status} />}
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                            {run?.event} · {run && new Date(run.created_at).toLocaleString()}
                        </span>
                        {isOwnerOrAdmin && run && (run.status === 'queued' || run.status === 'running') && (
                            <button
                                onClick={() => cancelMutation.mutate()}
                                disabled={cancelMutation.isPending}
                                className="ml-auto px-3 py-1.5 flex gap-2 items-center text-sm text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                            >
                                <CircleSlash size={15} />
                                {t("actions.cancel")}
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-sm font-semibold">{t("pages.workflows.jobs")}</div>
                        <div className="flex gap-2 flex-wrap">
                            {jobs.map(job => (
                                <button
                                    key={job.id}
                                    onClick={() => setSelectedJobId(job.id)}
                                    className={`px-3 py-1.5 rounded text-sm flex items-center gap-2 border ${selectedJob?.id === job.id
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                        : "border-neutral-200 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700"}`}
                                >
                                    {job.name}
                                    <StatusBadge status={job.status} />
                                </button>
                            ))}
                        </div>
                        {selectedJob && run && (
                            <JobLogs workspaceId={currentWorkspaceId} runId={run.id} job={selectedJob} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    </OneColumn>
}

export default RunDetailPage
