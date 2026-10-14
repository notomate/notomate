import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Loader, Package, Search, Store } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { useEditor, useEditorStore } from "./store"
import * as m from "./model/mutate"
import { useActionCatalog, type ActionEntry } from "./actions/catalog"

const USES_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\-/]+@[^\s@]+$/

function matches(e: ActionEntry, q: string) {
    if (!q) return true
    return [e.name, e.uses, e.description ?? ""].some(s => s.toLowerCase().includes(q))
}

/** Picks an action for a new step, or for an existing step when stepIndex is set. */
export default function ActionPickerDialog() {
    const { t } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const store = useEditorStore()
    const target = useEditor(s => s.picker)
    const catalog = useActionCatalog()
    const [query, setQuery] = useState("")
    const q = query.trim().toLowerCase()

    const groups = useMemo(() => {
        const bySource = new Map<string, ActionEntry[]>()
        for (const e of catalog.marketplace) {
            if (!matches(e, q)) continue
            bySource.set(e.source, [...(bySource.get(e.source) ?? []), e])
        }
        const out = [...bySource.entries()].map(([source, items]) => ({ source, label: source, items }))
        const builtin = catalog.builtin.filter(e => matches(e, q))
        if (builtin.length) out.push({ source: "builtin", label: t("pages.workflows.visual.builtinActions"), items: builtin })
        return out
    }, [catalog, q, t])

    const close = () => {
        store.getState().openPicker(null)
        setQuery("")
    }

    const choose = (uses: string, name?: string) => {
        if (!target) return
        const { jobId, stepIndex } = target
        store.getState().apply(
            doc => {
                if (stepIndex === undefined) m.addStep(doc, jobId, name ? { name, uses } : { uses })
                else m.updateStep(doc, jobId, stepIndex, { uses, with: undefined, run: undefined, shell: undefined, "working-directory": undefined })
            },
            () => ({ selection: { kind: "job", id: jobId } }),
        )
        close()
    }

    const custom = USES_RE.test(query.trim()) ? query.trim() : null

    return (
        <Modal open={!!target} onOpenChange={open => { if (!open) close() }} showClose
            title={t(target?.stepIndex === undefined ? "pages.workflows.visual.pickerAddTitle" : "pages.workflows.visual.pickerReplaceTitle")}
            className="max-w-[680px] max-h-[85vh] flex flex-col">
            <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                    placeholder={t("pages.workflows.visual.pickerSearch")}
                    className="w-full pl-9 pr-3 py-2 border dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 focus-visible:outline-primary"
                    onKeyDown={e => { if (e.key === "Enter" && custom) choose(custom) }} />
            </div>

            <div className="overflow-y-auto -mx-2 px-2 flex flex-col gap-4 min-h-[200px]">
                {custom && (
                    <button type="button" onClick={() => choose(custom)}
                        className="text-left px-3 py-2 rounded-lg border border-dashed dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-sm">
                        {t("pages.workflows.visual.pickerUseCustom")} <code className="font-mono">{custom}</code>
                    </button>
                )}
                {catalog.isLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader size={14} className="animate-spin" />{t("pages.workflows.marketplace.loading")}</div>
                )}
                {!catalog.isLoading && catalog.marketplace.length === 0 && (
                    <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm bg-neutral-50 dark:bg-neutral-900 text-muted-foreground">
                        <Store size={16} className="shrink-0 mt-0.5" />
                        <span>
                            {t("pages.workflows.visual.pickerNoMarketplace")}{" "}
                            <Link to={`/workspaces/${workspaceId}/workflows/marketplace`} className="underline" onClick={close}>{t("pages.workflows.marketplace.title")}</Link>
                        </span>
                    </div>
                )}
                {groups.map(g => (
                    <section key={g.source}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 font-mono">{g.label}</h3>
                        <ul className="flex flex-col gap-1">
                            {g.items.map(e => {
                                const required = e.inputs.filter(i => i.required && i.default === undefined).length
                                return (
                                    <li key={e.uses}>
                                        <button type="button" onClick={() => choose(e.uses, e.name)}
                                            className="w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60">
                                            <Package size={16} className="shrink-0 mt-0.5 text-primary" />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    <span className="font-medium truncate">{e.name}</span>
                                                    {required > 0 && <span className="text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 shrink-0">{t("pages.workflows.visual.requiredCount", { count: required })}</span>}
                                                </span>
                                                <span className="block font-mono text-xs text-muted-foreground truncate">{e.uses}</span>
                                                {e.description && <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">{e.description}</span>}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                ))}
                {groups.length === 0 && !custom && !catalog.isLoading && (
                    <p className="text-sm text-muted-foreground text-center py-6">{t("pages.workflows.visual.pickerNoResults")}</p>
                )}
            </div>
        </Modal>
    )
}
