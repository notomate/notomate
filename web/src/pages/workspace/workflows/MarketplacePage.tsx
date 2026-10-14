import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { isAxiosError } from "axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, ExternalLink, GitBranch, Loader, Package, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { getWorkspaceMembers } from "@/api/workspace"
import {
    actionSourcesKey, createActionSource, deleteActionSource, getActionSources, getMarketplaceActions,
    marketplaceActionsKey, syncActionSource, type ActionSourceData, type MarketplaceActionData,
} from "@/api/actionMarketplace"
import { useCurrentUserStore } from "@/stores/current-user"
import { toast } from "@/stores/toast"
import { cn } from "@/lib/utils"
import OneColumn from "@/components/onecolumn/OneColumn"

const errorMessage = (error: unknown) => {
    const data = isAxiosError<{ message?: string; error?: string }>(error) ? error.response?.data : undefined
    return data?.message || data?.error || (error instanceof Error ? error.message : "Request failed")
}

const inputClass = "px-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-sm focus-visible:outline-primary"

const MarketplacePage = () => {
    const workspaceId = useCurrentWorkspaceId()
    const { t } = useTranslation()
    const { user: currentUser } = useCurrentUserStore()
    const [query, setQuery] = useState("")

    const { data: members = [] } = useQuery({
        queryKey: ['workspaceMembers', workspaceId],
        queryFn: () => getWorkspaceMembers(workspaceId),
        enabled: !!workspaceId
    })
    const currentMember = members.find(m => m.user_id === currentUser?.id)
    const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin'

    const { data: sources = [], isPending: sourcesPending } = useQuery({
        queryKey: actionSourcesKey(workspaceId),
        queryFn: () => getActionSources(workspaceId),
        enabled: !!workspaceId
    })
    const { data: actions = [], isPending: actionsPending } = useQuery({
        queryKey: marketplaceActionsKey(workspaceId),
        queryFn: () => getMarketplaceActions(workspaceId),
        enabled: !!workspaceId
    })

    const q = query.trim().toLowerCase()
    const filtered = useMemo(() => actions.filter(a =>
        !q || [a.name, a.uses, a.description, a.author].some(s => s.toLowerCase().includes(q))), [actions, q])
    const sourceById = useMemo(() => new Map(sources.map(s => [s.id, s])), [sources])
    const countBySource = useMemo(() => {
        const counts = new Map<string, number>()
        for (const a of actions) counts.set(a.source_id, (counts.get(a.source_id) ?? 0) + 1)
        return counts
    }, [actions])

    return <OneColumn>
        <div className="w-full px-4 xl:px-4">
            <div className="flex flex-col min-h-screen pb-6 gap-4 max-w-5xl">
                <div className="py-2.5 flex items-center">
                    <div className="flex gap-3 items-center sm:text-xl font-semibold h-10 min-w-0">
                        <Link to=".." relative="path" className="hover:underline shrink-0">{t("pages.workflows.title")}</Link>
                        <span className="opacity-40 shrink-0">/</span>
                        <span className="truncate">{t("pages.workflows.marketplace.title")}</span>
                    </div>
                </div>

                <section className="bg-white dark:bg-neutral-800 rounded shadow-sm p-5 flex flex-col gap-3">
                    <div>
                        <div className="text-lg font-semibold">{t("pages.workflows.marketplace.sourcesTitle")}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{t("pages.workflows.marketplace.sourcesHint")}</div>
                    </div>
                    {canManage && <AddSourceForm workspaceId={workspaceId} />}
                    {sourcesPending ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader size={14} className="animate-spin" />{t("pages.workflows.marketplace.loading")}</div>
                    ) : sources.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-2">{t("pages.workflows.marketplace.noSources")}</div>
                    ) : (
                        <ul className="list-none divide-y divide-neutral-100 dark:divide-neutral-700">
                            {sources.map(s => <SourceRow key={s.id} source={s} count={countBySource.get(s.id) ?? 0} canManage={canManage} workspaceId={workspaceId} />)}
                        </ul>
                    )}
                    {canManage && (
                        <div className="text-xs text-muted-foreground">
                            {t("pages.workflows.marketplace.privateHint")}{" "}
                            <Link to="../settings" relative="path" className="underline">{t("pages.workflows.settingsTitle")}</Link>
                        </div>
                    )}
                </section>

                <section className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-lg font-semibold">
                            {t("pages.workflows.marketplace.actionsTitle")}
                            <span className="ml-2 text-sm font-normal text-muted-foreground">{actions.length}</span>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("pages.workflows.marketplace.search")}
                                className={cn(inputClass, "w-full pl-9")} />
                        </div>
                    </div>
                    {actionsPending ? null : filtered.length === 0 ? (
                        <div className="bg-white dark:bg-neutral-800 rounded shadow-sm p-8 text-center text-sm text-muted-foreground">
                            {actions.length === 0 ? t("pages.workflows.marketplace.noActions") : t("pages.workflows.marketplace.noResults")}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filtered.map(a => <ActionCard key={a.id} action={a} source={sourceById.get(a.source_id)} />)}
                        </div>
                    )}
                </section>
            </div>
        </div>
    </OneColumn>
}

const AddSourceForm = ({ workspaceId }: { workspaceId: string }) => {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const [repo, setRepo] = useState("")
    const [ref, setRef] = useState("")

    const mutation = useMutation({
        mutationFn: () => createActionSource(workspaceId, { repo: repo.trim(), ref: ref.trim() || undefined }),
        onSuccess: source => {
            setRepo("")
            setRef("")
            if (source.status === "ok") toast.success(t("pages.workflows.marketplace.sourceAdded"))
            else toast.error(t("pages.workflows.marketplace.syncFailed"), source.last_error)
        },
        onError: error => toast.error(errorMessage(error)),
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: actionSourcesKey(workspaceId) })
            queryClient.invalidateQueries({ queryKey: marketplaceActionsKey(workspaceId) })
        },
    })

    return (
        <form className="flex gap-2 flex-wrap" onSubmit={e => { e.preventDefault(); if (repo.trim()) mutation.mutate() }}>
            <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo" disabled={mutation.isPending}
                className={cn(inputClass, "font-mono flex-1 min-w-[200px]")} aria-label={t("pages.workflows.marketplace.repo")} />
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder={t("pages.workflows.marketplace.refPlaceholder")} disabled={mutation.isPending}
                className={cn(inputClass, "font-mono w-40")} aria-label="ref" />
            <button type="submit" disabled={!repo.trim() || mutation.isPending}
                className="px-4 py-2 flex gap-2 items-center text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending ? <Loader size={15} className="animate-spin" /> : <Plus size={15} />}
                {mutation.isPending ? t("pages.workflows.marketplace.syncing") : t("pages.workflows.marketplace.addSource")}
            </button>
        </form>
    )
}

const statusClass: Record<ActionSourceData["status"], string> = {
    ok: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending: "bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400",
}

const SourceRow = ({ source, count, canManage, workspaceId }: { source: ActionSourceData; count: number; canManage: boolean; workspaceId: string }) => {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: actionSourcesKey(workspaceId) })
        queryClient.invalidateQueries({ queryKey: marketplaceActionsKey(workspaceId) })
    }
    const syncMutation = useMutation({
        mutationFn: () => syncActionSource(workspaceId, source.id),
        onSuccess: s => s.status === "ok"
            ? toast.success(t("pages.workflows.marketplace.synced"))
            : toast.error(t("pages.workflows.marketplace.syncFailed"), s.last_error),
        onError: error => toast.error(errorMessage(error)),
        onSettled: invalidate,
    })
    const deleteMutation = useMutation({
        mutationFn: () => deleteActionSource(workspaceId, source.id),
        onSuccess: () => toast.success(t("pages.workflows.marketplace.sourceRemoved")),
        onError: error => toast.error(errorMessage(error)),
        onSettled: invalidate,
    })
    const ref = source.ref || source.resolved_ref
    const busy = syncMutation.isPending || deleteMutation.isPending

    return (
        <li className="py-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
                <a href={`https://github.com/${source.owner}/${source.repo}`} target="_blank" rel="noreferrer" className="font-mono font-medium hover:underline flex items-center gap-1">
                    {source.owner}/{source.repo}<ExternalLink size={12} className="opacity-50" />
                </a>
                {ref && <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground"><GitBranch size={12} />{ref}{!source.ref && ` (${t("pages.workflows.marketplace.defaultBranch")})`}</span>}
                <span className={cn("text-xs px-2 py-0.5 rounded-full", statusClass[source.status])}>{t(`pages.workflows.marketplace.status.${source.status}`)}</span>
                <span className="text-xs text-muted-foreground">{t("pages.workflows.marketplace.actionCount", { count })}</span>
                {canManage && (
                    <div className="ml-auto flex items-center gap-1">
                        <button type="button" onClick={() => syncMutation.mutate()} disabled={busy}
                            className="px-2 py-1 flex gap-1.5 items-center text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">
                            <RefreshCw size={13} className={cn(syncMutation.isPending && "animate-spin")} />{t("pages.workflows.marketplace.sync")}
                        </button>
                        <button type="button" disabled={busy} aria-label={t("actions.delete")}
                            onClick={() => { if (confirm(t("pages.workflows.marketplace.removeConfirm"))) deleteMutation.mutate() }}
                            className="px-2 py-1 flex items-center text-xs rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                            <Trash2 size={13} />
                        </button>
                    </div>
                )}
            </div>
            <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                {source.resolved_sha && <span className="font-mono">{source.resolved_sha.slice(0, 7)}</span>}
                {source.last_synced_at && <span>{t("pages.workflows.marketplace.lastSynced", { time: new Date(source.last_synced_at).toLocaleString() })}</span>}
            </div>
            {source.last_error && (
                <pre className={cn("text-xs whitespace-pre-wrap break-words font-sans", source.status === "error" ? "text-red-500" : "text-amber-600 dark:text-amber-400")}>{source.last_error}</pre>
            )}
        </li>
    )
}

const ActionCard = ({ action, source }: { action: MarketplaceActionData; source?: ActionSourceData }) => {
    const { t } = useTranslation()
    const copy = () => navigator.clipboard.writeText(action.uses).then(
        () => toast.success(t("pages.workflows.marketplace.copied")),
        () => toast.error(t("pages.workflows.marketplace.copyFailed")),
    )
    const link = source ? `https://github.com/${source.owner}/${source.repo}/tree/${source.resolved_sha || source.resolved_ref}${action.path ? "/" + action.path : ""}` : undefined

    return (
        <article className="bg-white dark:bg-neutral-800 rounded shadow-sm p-4 flex flex-col gap-2 min-w-0">
            <div className="flex items-start gap-3">
                <Package size={18} className="shrink-0 mt-0.5 text-primary" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold truncate">{action.name}</h3>
                        {link && <a href={link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary shrink-0"><ExternalLink size={13} /></a>}
                    </div>
                    {action.author && <div className="text-xs text-muted-foreground truncate">{action.author}</div>}
                </div>
                {action.runs_using && <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 font-mono shrink-0">{action.runs_using}</span>}
            </div>
            {action.description && <p className="text-sm text-muted-foreground line-clamp-3">{action.description}</p>}
            <button type="button" onClick={copy} title={t("pages.workflows.marketplace.copyUses")}
                className="flex items-center gap-2 px-2 py-1.5 rounded bg-neutral-50 dark:bg-neutral-900 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 min-w-0">
                <code className="font-mono text-xs truncate flex-1">{action.uses}</code>
                <Copy size={12} className="shrink-0 opacity-60" />
            </button>
            {(action.inputs.length > 0 || action.outputs.length > 0) && (
                <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground select-none">
                        {t("pages.workflows.marketplace.inputsOutputs", { inputs: action.inputs.length, outputs: action.outputs.length })}
                    </summary>
                    <dl className="mt-2 flex flex-col gap-1.5">
                        {action.inputs.map(i => (
                            <div key={`in-${i.name}`}>
                                <dt className="font-mono flex items-center gap-1.5">
                                    {i.name}
                                    {i.required && <span className="text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t("pages.workflows.visual.required")}</span>}
                                    {i.default !== undefined && i.default !== "" && <span className="text-muted-foreground truncate">= {i.default}</span>}
                                </dt>
                                {i.description && <dd className="text-muted-foreground line-clamp-2">{i.description}</dd>}
                            </div>
                        ))}
                        {action.outputs.map(o => (
                            <div key={`out-${o.name}`}>
                                <dt className="font-mono">→ {o.name}</dt>
                                {o.description && <dd className="text-muted-foreground line-clamp-2">{o.description}</dd>}
                            </div>
                        ))}
                    </dl>
                </details>
            )}
        </article>
    )
}

export default MarketplacePage
