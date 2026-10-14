import { useState } from "react"
import { isAxiosError } from "axios"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader, Trash2 } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { deleteGitHubIntegration, getGitHubIntegration, githubIntegrationKey, updateGitHubIntegration } from "@/api/actionMarketplace"
import { toast } from "@/stores/toast"

const errorMessage = (error: unknown) => {
    const data = isAxiosError<{ message?: string }>(error) ? error.response?.data : undefined
    return data?.message || (error instanceof Error ? error.message : "Request failed")
}

// Workspace GitHub token for private action repositories. Write-only: the API
// reports whether one is set but never returns it.
const GitHubTokenSection = () => {
    const workspaceId = useCurrentWorkspaceId()
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [token, setToken] = useState("")

    const { data: status } = useQuery({
        queryKey: githubIntegrationKey(workspaceId),
        queryFn: () => getGitHubIntegration(workspaceId),
        enabled: !!workspaceId,
    })
    const invalidate = () => queryClient.invalidateQueries({ queryKey: githubIntegrationKey(workspaceId) })

    const saveMutation = useMutation({
        mutationFn: () => updateGitHubIntegration(workspaceId, token.trim()),
        onSuccess: () => {
            toast.success(t("pages.workflows.githubToken.saved"))
            setToken("")
            invalidate()
        },
        onError: error => toast.error(errorMessage(error)),
    })

    const deleteMutation = useMutation({
        mutationFn: () => deleteGitHubIntegration(workspaceId),
        onSuccess: () => {
            toast.success(t("pages.workflows.githubToken.removed"))
            invalidate()
        },
        onError: error => toast.error(errorMessage(error)),
    })

    const configured = !!status?.configured

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t("pages.workflows.githubToken.title")}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${configured ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"}`}>
                    {configured ? t("pages.workflows.githubToken.configured") : t("pages.workflows.githubToken.notConfigured")}
                </span>
            </div>
            <div className="text-xs text-muted-foreground -mt-1">{t("pages.workflows.githubToken.hint")}</div>

            <form className="flex gap-2 items-center" onSubmit={e => { e.preventDefault(); if (token.trim()) saveMutation.mutate() }}>
                <input
                    type="password"
                    autoComplete="off"
                    className="flex-1 px-3 py-2 border dark:border-none rounded-lg dark:bg-neutral-700 text-sm"
                    placeholder={configured ? t("pages.workflows.githubToken.replacePlaceholder") : "github_pat_..."}
                    aria-label={t("pages.workflows.githubToken.title")}
                    value={token}
                    onChange={e => setToken(e.target.value)}
                />
                {configured && (
                    <button
                        type="button"
                        onClick={() => { if (confirm(t("pages.workflows.githubToken.removeConfirm"))) deleteMutation.mutate() }}
                        disabled={deleteMutation.isPending}
                        aria-label={t("actions.delete")}
                        className="px-3 py-2 flex gap-2 items-center text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50"
                    >
                        <Trash2 size={15} />
                    </button>
                )}
                <button
                    type="submit"
                    disabled={saveMutation.isPending || !token.trim()}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
                >
                    {saveMutation.isPending ? <Loader size={16} className="animate-spin" /> : t("actions.save")}
                </button>
            </form>
        </div>
    )
}

export default GitHubTokenSection
