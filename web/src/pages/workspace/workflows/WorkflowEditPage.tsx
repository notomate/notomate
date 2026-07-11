import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { History, Play, Save, Trash2, Loader } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import {
    getWorkflow, createWorkflow, updateWorkflow, deleteWorkflow, dispatchWorkflow,
    WorkflowValidationError,
} from "@/api/workflow"
import { toast } from "@/stores/toast"
import OneColumn from "@/components/onecolumn/OneColumn"
import DispatchDialog from "./DispatchDialog"

const DEFAULT_DEFINITION = `name: My workflow
on:
  note:
    types: [created, updated]
  workflow_dispatch:
jobs:
  hello:
    runs-on: ubuntu-latest
    steps:
      - run: echo "event=$NM_EVENT_NAME note=$NM_NOTE_ID"
`

const WorkflowEditPage = () => {
    const currentWorkspaceId = useCurrentWorkspaceId()
    const { workflowId } = useParams()
    const isNew = !workflowId
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    const [name, setName] = useState("")
    const [definition, setDefinition] = useState(DEFAULT_DEFINITION)
    const [validationErrors, setValidationErrors] = useState<WorkflowValidationError[]>([])
    const [showDispatch, setShowDispatch] = useState(false)

    const { data: workflow } = useQuery({
        queryKey: ['workflow', currentWorkspaceId, workflowId],
        queryFn: () => getWorkflow(currentWorkspaceId, workflowId!),
        enabled: !!currentWorkspaceId && !isNew
    })

    useEffect(() => {
        if (workflow) {
            setName(workflow.name)
            setDefinition(workflow.definition)
        }
    }, [workflow])

    const handleError = (error: any) => {
        const errors = error?.response?.data?.errors
        if (Array.isArray(errors)) {
            setValidationErrors(errors)
            toast.error(t("pages.workflows.validationFailed"))
        } else {
            toast.error(error?.response?.data?.message || error?.message || "Request failed")
        }
    }

    const saveMutation = useMutation({
        mutationFn: () => isNew
            ? createWorkflow(currentWorkspaceId, { name, definition })
            : updateWorkflow(currentWorkspaceId, workflowId!, { name, definition }),
        onSuccess: (data) => {
            setValidationErrors([])
            toast.success(t("pages.workflows.workflowSaved"))
            queryClient.invalidateQueries({ queryKey: ['workflows', currentWorkspaceId] })
            if (isNew) {
                navigate(`../${data.id}`, { relative: "path" })
            }
        },
        onError: handleError
    })

    const deleteMutation = useMutation({
        mutationFn: () => deleteWorkflow(currentWorkspaceId, workflowId!),
        onSuccess: () => {
            toast.success(t("pages.workflows.workflowDeleted"))
            queryClient.invalidateQueries({ queryKey: ['workflows', currentWorkspaceId] })
            navigate("..", { relative: "path" })
        },
        onError: handleError
    })

    const dispatchMutation = useMutation({
        mutationFn: (inputs: Record<string, string>) => dispatchWorkflow(currentWorkspaceId, workflowId!, inputs),
        onSuccess: (run) => {
            setShowDispatch(false)
            toast.success(t("pages.workflows.dispatched"))
            navigate(`runs/${run.id}`)
        },
        onError: handleError
    })

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen">
                <div className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10 min-w-0">
                        <Link to=".." relative="path" className="hover:underline shrink-0">
                            {t("pages.workflows.title")}
                        </Link>
                        <span className="opacity-40 shrink-0">/</span>
                        <span className="truncate">{isNew ? t("pages.workflows.newWorkflow") : workflow?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        {!isNew && (
                            <>
                                <Link
                                    to="runs"
                                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                                >
                                    <History size={16} />
                                    {t("pages.workflows.runs")}
                                </Link>
                                <button
                                    onClick={() => setShowDispatch(true)}
                                    disabled={dispatchMutation.isPending}
                                    className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                >
                                    <Play size={16} />
                                    {t("pages.workflows.dispatch")}
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(t("pages.workflows.deleteConfirm"))) deleteMutation.mutate()
                                    }}
                                    disabled={deleteMutation.isPending}
                                    className="px-3 py-2 flex gap-2 items-center text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending || !name || !definition}
                            className="px-4 py-2 flex gap-2 items-center bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saveMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            {t("actions.save")}
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-neutral-800 rounded shadow-sm w-full max-w-3xl p-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold">{t("pages.workflows.name")}</label>
                        <input
                            className="px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder={t("pages.workflows.namePlaceholder")}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold">{t("pages.workflows.definition")}</label>
                        <textarea
                            className="px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700 font-mono text-sm min-h-[360px] whitespace-pre"
                            spellCheck={false}
                            value={definition}
                            onChange={e => setDefinition(e.target.value)}
                        />
                    </div>
                    {validationErrors.length > 0 && (
                        <div className="p-3 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm flex flex-col gap-1">
                            {validationErrors.map((err, i) => (
                                <div key={i}>
                                    {err.line > 0 && <span className="font-mono">L{err.line}: </span>}
                                    {err.message}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {showDispatch && (
            <DispatchDialog
                definition={definition}
                isPending={dispatchMutation.isPending}
                onDispatch={(inputs) => dispatchMutation.mutate(inputs)}
                onClose={() => setShowDispatch(false)}
            />
        )}
    </OneColumn>
}

export default WorkflowEditPage
