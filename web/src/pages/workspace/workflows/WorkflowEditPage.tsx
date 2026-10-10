import { useEffect, useRef, useState } from "react"
import { isAxiosError } from "axios"
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
import WorkflowDefinitionEditor from "./WorkflowDefinitionEditor"
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
    const { workflowId } = useParams()
    const workspaceId = useCurrentWorkspaceId()
    return <WorkflowEditForm key={`${workspaceId}:${workflowId ?? "new"}`} />
}

const WorkflowEditForm = () => {
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

    const initialized = useRef(false)
    const [saved, setSaved] = useState({ name: "", definition: DEFAULT_DEFINITION })
    const dirty = name !== saved.name || definition !== saved.definition

    const { data: workflow, isPending, isError, refetch } = useQuery({
        queryKey: ['workflow', currentWorkspaceId, workflowId],
        queryFn: () => getWorkflow(currentWorkspaceId, workflowId!),
        enabled: !!currentWorkspaceId && !isNew
    })

    useEffect(() => {
        if (workflow && !initialized.current) {
            initialized.current = true
            setSaved({ name: workflow.name, definition: workflow.definition })
            setName(workflow.name)
            setDefinition(workflow.definition)
        }
    }, [workflow])

    const handleError = (error: unknown) => {
        const response = isAxiosError<{ errors?: WorkflowValidationError[]; message?: string }>(error) ? error.response?.data : undefined
        const errors = response?.errors
        if (Array.isArray(errors)) {
            setValidationErrors(errors)
            toast.error(t("pages.workflows.validationFailed"))
        } else {
            toast.error(response?.message || (error instanceof Error ? error.message : "Request failed"))
        }
    }

    const saveMutation = useMutation({
        mutationFn: (draft: { name: string; definition: string }) => isNew
            ? createWorkflow(currentWorkspaceId, draft)
            : updateWorkflow(currentWorkspaceId, workflowId!, draft),
        onSuccess: (data) => {
            setValidationErrors([])
            setSaved({ name: data.name, definition: data.definition })
            queryClient.setQueryData(['workflow', currentWorkspaceId, data.id], data)
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

    const busy = saveMutation.isPending || deleteMutation.isPending || dispatchMutation.isPending
    const ready = isNew || (initialized.current && !isPending && !isError)
    const canSave = ready && !busy && !!name.trim() && !!definition.trim() && (isNew || dirty)
    const save = () => { if (canSave) saveMutation.mutate({ name, definition }) }

    useEffect(() => {
        if (!dirty) return
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault()
            event.returnValue = ""
        }
        window.addEventListener("beforeunload", warn)
        return () => window.removeEventListener("beforeunload", warn)
    }, [dirty])

    useEffect(() => {
        const shortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault()
                if (canSave) saveMutation.mutate({ name, definition })
            }
        }
        window.addEventListener("keydown", shortcut)
        return () => window.removeEventListener("keydown", shortcut)
    }, [canSave, name, definition, saveMutation])

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-full pb-6">
                <div className="py-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10 min-w-0">
                        <Link to=".." relative="path" className="hover:underline shrink-0">
                            {t("pages.workflows.title")}
                        </Link>
                        <span className="opacity-40 shrink-0">/</span>
                        <span className="truncate">{isNew ? t("pages.workflows.newWorkflow") : workflow?.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap [&_button]:whitespace-nowrap [&_a]:whitespace-nowrap">
                        {!isNew && (
                            <>
                                <Link
                                    to="runs"
                                    className="px-3 py-2 flex gap-2 items-center text-muted-foreground dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                                >
                                    <History size={16} />
                                    {t("pages.workflows.runs")}
                                </Link>
                                <button
                                    onClick={() => setShowDispatch(true)}
                                    disabled={!ready || busy || dirty}
                                    title={dirty ? t("pages.workflows.saveBeforeRun") : undefined}
                                    className="px-3 py-2 flex gap-2 items-center text-muted-foreground dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-50"
                                >
                                    <Play size={16} />
                                    {t("pages.workflows.dispatch")}
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(t("pages.workflows.deleteConfirm"))) deleteMutation.mutate()
                                    }}
                                    disabled={!ready || busy}
                                    aria-label={t("actions.delete")}
                                    className="px-3 py-2 flex gap-2 items-center text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded disabled:opacity-50"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={save}
                            disabled={!canSave}
                            className="px-4 py-2 flex gap-2 items-center bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saveMutation.isPending ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
                            {t("actions.save")}
                        </button>
                    </div>
                </div>

                {!isNew && isPending ? <div role="status" className="flex items-center gap-2 py-12 text-muted-foreground"><Loader size={18} className="animate-spin" />{t("pages.workflows.loadingEditor")}</div>
                    : !isNew && isError ? <div role="alert" className="py-12"><p>{t("pages.workflows.loadFailed")}</p><button onClick={() => refetch()} className="mt-3 underline">{t("pages.workflows.retry")}</button></div>
                    : <div className="w-full min-w-0 flex flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-3 py-3">
                            <div className="flex flex-col gap-2 w-full sm:max-w-md">
                                <label htmlFor="workflow-name" className="text-sm font-semibold">{t("pages.workflows.name")}</label>
                                <input id="workflow-name" className="w-full px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus-visible:outline-primary"
                                    value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder={t("pages.workflows.namePlaceholder")} />
                            </div>
                            <span role="status" className="text-xs text-muted-foreground">{t(saveMutation.isPending ? "pages.workflows.saving" : dirty || isNew ? "pages.workflows.unsavedChanges" : "pages.workflows.allChangesSaved")}</span>
                        </div>
                        <WorkflowDefinitionEditor value={definition} disabled={busy} errors={validationErrors}
                            onChange={value => { setDefinition(value); setValidationErrors([]) }} />
                        {!isNew && dirty && <p className="text-xs text-muted-foreground">{t("pages.workflows.saveBeforeRun")}</p>}
                    </div>}

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
