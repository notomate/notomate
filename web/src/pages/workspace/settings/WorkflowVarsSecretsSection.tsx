import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, X, Trash2, Loader } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import {
    getWorkflowVars, createWorkflowVar, deleteWorkflowVar,
    getWorkflowSecrets, createWorkflowSecret, deleteWorkflowSecret,
    WorkflowVarData, WorkflowSecretData,
} from "@/api/workflow"
import { toast } from "@/stores/toast"

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

// Shared add-row form for both vars and secrets: a key + value pair with
// client-side key-format validation mirroring the backend's regex.
const AddEntryForm = ({
    keyPlaceholder, valuePlaceholder, isPending, onSubmit, onCancel,
}: {
    keyPlaceholder: string
    valuePlaceholder: string
    isPending: boolean
    onSubmit: (key: string, value: string) => void
    onCancel: () => void
}) => {
    const { t } = useTranslation()
    const [key, setKey] = useState("")
    const [value, setValue] = useState("")
    const [error, setError] = useState("")

    const handleSubmit = () => {
        if (!KEY_PATTERN.test(key)) {
            setError(t("pages.settings.invalidKeyFormat"))
            return
        }
        setError("")
        onSubmit(key, value)
    }

    return (
        <div className="flex flex-col gap-2 p-3 bg-neutral-50 dark:bg-neutral-700 rounded">
            <div className="flex gap-2 flex-wrap">
                <input
                    className="flex-1 min-w-[140px] px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-600 font-mono text-sm"
                    placeholder={keyPlaceholder}
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    autoFocus
                />
                <input
                    className="flex-1 min-w-[140px] px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-600 font-mono text-sm"
                    placeholder={valuePlaceholder}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                />
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
            <div className="flex gap-2 justify-end">
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 rounded"
                >
                    {t("actions.cancel")}
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isPending || !key || !value}
                    className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 flex items-center gap-2"
                >
                    {isPending && <Loader size={14} className="animate-spin" />}
                    {t("actions.add")}
                </button>
            </div>
        </div>
    )
}

const WorkflowVarsSecretsSection = () => {
    const { t } = useTranslation()
    const currentWorkspaceId = useCurrentWorkspaceId()
    const queryClient = useQueryClient()
    const [showAddVar, setShowAddVar] = useState(false)
    const [showAddSecret, setShowAddSecret] = useState(false)

    const { data: vars = [] } = useQuery({
        queryKey: ['workflowVars', currentWorkspaceId],
        queryFn: () => getWorkflowVars(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

    const { data: secrets = [] } = useQuery({
        queryKey: ['workflowSecrets', currentWorkspaceId],
        queryFn: () => getWorkflowSecrets(currentWorkspaceId),
        enabled: !!currentWorkspaceId,
    })

    const handleError = (error: any) => {
        toast.error(error?.response?.data?.message || error?.response?.data?.error || error?.message || "Request failed")
    }

    const createVarMutation = useMutation({
        mutationFn: (data: { key: string; value: string }) => createWorkflowVar(currentWorkspaceId, data),
        onSuccess: () => {
            setShowAddVar(false)
            queryClient.invalidateQueries({ queryKey: ['workflowVars', currentWorkspaceId] })
        },
        onError: handleError,
    })

    const deleteVarMutation = useMutation({
        mutationFn: (key: string) => deleteWorkflowVar(currentWorkspaceId, key),
        onSuccess: () => {
            toast.success(t("pages.settings.varDeleted"))
            queryClient.invalidateQueries({ queryKey: ['workflowVars', currentWorkspaceId] })
        },
        onError: handleError,
    })

    const createSecretMutation = useMutation({
        mutationFn: (data: { key: string; value: string }) => createWorkflowSecret(currentWorkspaceId, data),
        onSuccess: () => {
            setShowAddSecret(false)
            queryClient.invalidateQueries({ queryKey: ['workflowSecrets', currentWorkspaceId] })
        },
        onError: handleError,
    })

    const deleteSecretMutation = useMutation({
        mutationFn: (key: string) => deleteWorkflowSecret(currentWorkspaceId, key),
        onSuccess: () => {
            toast.success(t("pages.settings.secretDeleted"))
            queryClient.invalidateQueries({ queryKey: ['workflowSecrets', currentWorkspaceId] })
        },
        onError: handleError,
    })

    return (
        <>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{t("pages.settings.workflowVars")}</div>
                    <button
                        onClick={() => setShowAddVar(s => !s)}
                        className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm"
                    >
                        {showAddVar ? <X size={15} /> : <Plus size={15} />}
                        {t("pages.settings.addVariable")}
                    </button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                    {t("pages.settings.workflowVarsHint")}
                </div>

                {showAddVar && (
                    <AddEntryForm
                        keyPlaceholder={t("pages.settings.keyPlaceholder")}
                        valuePlaceholder={t("pages.settings.valuePlaceholder")}
                        isPending={createVarMutation.isPending}
                        onSubmit={(key, value) => createVarMutation.mutate({ key, value })}
                        onCancel={() => setShowAddVar(false)}
                    />
                )}

                {vars.length === 0 ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                        {t("pages.settings.noVars")}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700">
                        {vars.map((v: WorkflowVarData) => (
                            <div key={v.id} className="flex items-center gap-3 py-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium font-mono truncate">{v.key}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono">
                                        {v.value}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm(t("pages.settings.deleteVarConfirm"))) {
                                            deleteVarMutation.mutate(v.key)
                                        }
                                    }}
                                    disabled={deleteVarMutation.isPending}
                                    className="p-2 text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                    aria-label="delete variable"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{t("pages.settings.workflowSecrets")}</div>
                    <button
                        onClick={() => setShowAddSecret(s => !s)}
                        className="px-3 py-2 flex gap-2 items-center text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm"
                    >
                        {showAddSecret ? <X size={15} /> : <Plus size={15} />}
                        {t("pages.settings.addSecret")}
                    </button>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
                    {t("pages.settings.workflowSecretsHint")}
                </div>

                {showAddSecret && (
                    <AddEntryForm
                        keyPlaceholder={t("pages.settings.keyPlaceholder")}
                        valuePlaceholder={t("pages.settings.valuePlaceholder")}
                        isPending={createSecretMutation.isPending}
                        onSubmit={(key, value) => createSecretMutation.mutate({ key, value })}
                        onCancel={() => setShowAddSecret(false)}
                    />
                )}

                {secrets.length === 0 ? (
                    <div className="text-sm text-gray-400 dark:text-gray-500">
                        {t("pages.settings.noSecrets")}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-700">
                        {secrets.map((s: WorkflowSecretData) => (
                            <div key={s.id} className="flex items-center gap-3 py-3">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium font-mono truncate">{s.key}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 truncate font-mono">
                                        &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm(t("pages.settings.deleteSecretConfirm"))) {
                                            deleteSecretMutation.mutate(s.key)
                                        }
                                    }}
                                    disabled={deleteSecretMutation.isPending}
                                    className="p-2 text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-50"
                                    aria-label="delete secret"
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

export default WorkflowVarsSecretsSection
