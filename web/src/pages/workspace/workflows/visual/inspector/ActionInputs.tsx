import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { stringify } from "yaml"
import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import useCurrentWorkspaceId from "@/hooks/use-currentworkspace-id"
import { isRecord } from "../model/parse"
import * as m from "../model/mutate"
import { useEditorStore } from "../store"
import { DOCKER_EXTRA_INPUTS, actionKey, checkInputs, isRemoteUses, useActionCatalog, usesRef, type ActionEntry, type InputDef } from "../actions/catalog"
import { YamlField, inputClass, labelClass } from "./fields"
import RefPicker from "./RefPicker"

type Values = Record<string, unknown> | undefined

const display = (v: unknown) =>
    v === undefined || v === null ? "" : typeof v === "object" ? stringify(v, { lineWidth: 0 }).trimEnd() : String(v)

/** Writes a mapping back key by key, touching only changed keys. */
function useCommitMap(path: (string | number)[]) {
    const store = useEditorStore()
    return (patch: Record<string, unknown>) => store.getState().apply(doc => m.setMapKeys(doc, path, patch))
}

function diffPatch(before: Record<string, unknown>, after: Record<string, unknown>) {
    const patch: Record<string, unknown> = {}
    for (const k of Object.keys(before)) if (!(k in after)) patch[k] = undefined
    for (const [k, v] of Object.entries(after)) if (JSON.stringify(before[k]) !== JSON.stringify(v)) patch[k] = v
    return patch
}

function githubLink(uses: string): string | null {
    if (!isRemoteUses(uses)) return null
    const [owner, repo, ...path] = actionKey(uses).split("/")
    const ref = usesRef(uses) ?? "HEAD"
    return `https://github.com/${owner}/${repo}/tree/${ref}${path.length ? "/" + path.join("/") : ""}`
}

function MetaStatus({ uses, entry }: { uses: string; entry: ActionEntry | undefined }) {
    const { t } = useTranslation()
    const workspaceId = useCurrentWorkspaceId()
    const link = githubLink(uses)
    if (!entry) {
        return (
            <div className="text-xs rounded-md px-2.5 py-2 bg-neutral-100 dark:bg-neutral-900 text-muted-foreground">
                {isRemoteUses(uses) ? (
                    <>
                        {t("pages.workflows.visual.noMetadata")}{" "}
                        <Link to={`/workspaces/${workspaceId}/workflows/marketplace`} className="underline">{t("pages.workflows.marketplace.title")}</Link>
                    </>
                ) : t("pages.workflows.visual.metadataUnsupported")}
            </div>
        )
    }
    const refDiffers = usesRef(entry.uses) !== usesRef(uses)
    return (
        <div className="text-xs rounded-md px-2.5 py-2 bg-primary-50 dark:bg-neutral-900 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
                <strong className="text-sm">{entry.name}</strong>
                {link && (
                    <a href={link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title={t("pages.workflows.visual.openOnGitHub")}>
                        <ExternalLink size={12} />
                    </a>
                )}
            </div>
            {entry.description && <p className="text-muted-foreground line-clamp-3">{entry.description}</p>}
            <div className="text-muted-foreground">
                {entry.source === "builtin" ? t("pages.workflows.visual.sourceBuiltin") : t("pages.workflows.visual.sourceMarketplace", { source: entry.source })}
                {refDiffers && ` · ${t("pages.workflows.visual.metadataFromRef", { ref: usesRef(entry.uses) })}`}
            </div>
        </div>
    )
}

/** One input; Enter commits, Shift+Enter adds a line. */
function InputRow({ def, value, onCommit }: { def: InputDef; value: unknown; onCommit: (v: unknown) => void }) {
    const { t } = useTranslation()
    const id = useId()
    const text = display(value)
    const [local, setLocal] = useState(text)
    useEffect(() => setLocal(text), [text])
    const commit = (v = local) => {
        if (v === text) return
        onCommit(v === "" ? undefined : m.inputValue(v))
    }
    const missing = def.required && def.default === undefined && value === undefined

    return (
        <div className={cn("flex flex-col gap-1", def.deprecationMessage && "opacity-70")}>
            <div className="flex items-center gap-1.5">
                <label htmlFor={id} className={cn(labelClass, "flex items-center gap-1.5 flex-wrap")}>
                    <span className="font-mono">{def.name}</span>
                    {def.required && <span className="text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">{t("pages.workflows.visual.required")}</span>}
                    {def.deprecationMessage && (
                        <span className="text-[10px] px-1 rounded bg-neutral-200 dark:bg-neutral-700" title={def.deprecationMessage}>{t("pages.workflows.visual.deprecated")}</span>
                    )}
                </label>
                <RefPicker onPick={expression => { setLocal(expression); commit(expression) }} />
            </div>
            <textarea
                id={id}
                className={cn(inputClass, "font-mono resize-y")}
                rows={Math.min(Math.max(local.split("\n").length, 1), 10)}
                value={local}
                spellCheck={false}
                placeholder={def.default !== undefined ? t("pages.workflows.visual.defaultValue", { value: def.default.split("\n")[0] }) : undefined}
                aria-invalid={missing}
                onChange={e => setLocal(e.target.value)}
                onBlur={() => commit()}
                onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        commit()
                    }
                    if (e.key === "Escape") setLocal(text)
                }}
            />
            {def.description && <div className="text-xs text-muted-foreground line-clamp-3" title={def.description}>{def.description}</div>}
        </div>
    )
}

/** Filled and required inputs first; the rest folded away. */
function InputList({ defs, values, onCommit }: { defs: InputDef[]; values: Values; onCommit: (name: string, v: unknown) => void }) {
    const { t } = useTranslation()
    const v = values ?? {}
    const primary = defs.filter(d => d.name in v || (d.required && d.default === undefined))
    const rest = defs.filter(d => !primary.includes(d))
    const [open, setOpen] = useState(primary.length === 0)
    const row = (d: InputDef) => <InputRow key={d.name} def={d} value={v[d.name]} onCommit={val => onCommit(d.name, val)} />
    return (
        <>
            {primary.map(row)}
            {rest.length > 0 && (
                <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="flex flex-col gap-3">
                    <summary className="text-xs cursor-pointer text-muted-foreground select-none">
                        {t(primary.length ? "pages.workflows.visual.otherInputs" : "pages.workflows.visual.availableInputs", { count: rest.length })}
                    </summary>
                    <div className="flex flex-col gap-3 mt-2">{rest.map(row)}</div>
                </details>
            )}
        </>
    )
}

/** A step's `with`, as a form when the action's inputs are known. */
export default function ActionInputs({ uses, values, path }: { uses: string; values: Values; path: (string | number)[] }) {
    const { t } = useTranslation()
    const { lookup } = useActionCatalog()
    const entry = lookup(uses)
    const commit = useCommitMap(path)

    let body
    if (entry) {
        const defs = [...entry.inputs]
        if (entry.using === "docker") {
            for (const n of DOCKER_EXTRA_INPUTS) if (!defs.some(d => d.name === n)) defs.push({ name: n, required: false })
        }
        const { unknown } = checkInputs(entry, values)
        const current = Object.fromEntries(unknown.map(k => [k, values?.[k]]))
        body = (
            <>
                {defs.length === 0
                    ? <p className="text-xs text-muted-foreground">{t("pages.workflows.visual.noInputs")}</p>
                    : <InputList defs={defs} values={values} onCommit={(name, v) => commit({ [name]: v })} />}
                <YamlField
                    label={unknown.length ? t("pages.workflows.visual.unknownInputs") : t("pages.workflows.visual.extraInputs")}
                    value={unknown.length ? current : undefined}
                    placeholder="key: value"
                    onCommit={v => commit(diffPatch(current, isRecord(v) ? v : {}))}
                />
            </>
        )
    } else {
        body = (
            <YamlField
                label="with"
                value={values}
                placeholder="key: value"
                onCommit={v => commit(diffPatch(values ?? {}, isRecord(v) ? v : {}))}
            />
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <MetaStatus uses={uses} entry={entry} />
            {body}
        </div>
    )
}
