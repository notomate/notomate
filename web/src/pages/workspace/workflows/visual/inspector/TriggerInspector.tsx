import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEditor, useEditorStore } from "../store"
import * as m from "../model/mutate"
import { isRecord } from "../model/parse"
import { TRIGGER_EVENTS, TRIGGER_TYPES, type TriggerEvent } from "../model/validate"
import { TRIGGER_ICONS } from "../labels"
import { Section, TextField, YamlField, hintClass, inputClass, labelClass } from "./fields"

const DEFAULT_CRON = "0 9 * * 1"

type DispatchInput = { description?: string; required?: boolean; default?: string }

export default function TriggerInspector() {
    const { t } = useTranslation()
    const store = useEditorStore()
    const view = useEditor(s => s.view)
    const { apply } = store.getState()
    const setTrigger = (event: string, value: unknown) => apply(doc => m.setTrigger(doc, event, value))
    const unsupported = view.triggers.filter(tr => !(TRIGGER_EVENTS as readonly string[]).includes(tr))

    const toggle = (event: TriggerEvent, on: boolean) => {
        if (!on) return setTrigger(event, undefined)
        setTrigger(event, event === "schedule" ? [{ cron: DEFAULT_CRON }] : null)
    }

    return (
        <div>
            <header className="px-4 py-3 border-b dark:border-neutral-700">
                <div className="text-xs text-muted-foreground">{t("pages.workflows.visual.workflow")}</div>
                <h2 className="font-semibold">{t("pages.workflows.visual.triggerNode")}</h2>
            </header>

            <Section>
                <TextField label="name" value={view.name} onCommit={v => apply(doc => m.setRootField(doc, "name", v))} />
            </Section>

            <Section title={t("pages.workflows.visual.events")}>
                {TRIGGER_EVENTS.map(event => {
                    const enabled = view.triggers.includes(event)
                    const Icon = TRIGGER_ICONS[event]
                    return (
                        <div key={event} className={cn("rounded-md border dark:border-neutral-700", enabled && "bg-neutral-50 dark:bg-neutral-900/50")}>
                            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer">
                                <input type="checkbox" checked={enabled} onChange={e => toggle(event, e.target.checked)} />
                                <Icon size={14} className="opacity-60" />
                                <span className="font-mono text-sm">{event}</span>
                                <span className="text-xs text-muted-foreground ml-auto truncate">{t(`pages.workflows.visual.eventHint.${event}`)}</span>
                            </label>
                            {enabled && (
                                <div className="px-3 pb-3 flex flex-col gap-2">
                                    <EventConfig event={event} value={view.on[event]} onChange={v => setTrigger(event, v)} />
                                </div>
                            )}
                        </div>
                    )
                })}
                {unsupported.map(tr => (
                    <div key={tr} className="flex items-center gap-2 px-3 py-2 rounded-md border border-red-300 dark:border-red-800 text-sm">
                        <span className="font-mono">{tr}</span>
                        <span className="text-xs text-red-500">{t("pages.workflows.visual.unsupportedEvent")}</span>
                        <button type="button" className="ml-auto text-red-500" aria-label={t("actions.delete")} onClick={() => setTrigger(tr, undefined)}>
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </Section>

            <Section>
                <YamlField
                    label="concurrency"
                    value={view.raw.concurrency}
                    placeholder={"group: my-group\ncancel-in-progress: true"}
                    hint={t("pages.workflows.visual.concurrencyHint")}
                    onCommit={v => apply(doc => m.setRootField(doc, "concurrency", v))}
                />
            </Section>
        </div>
    )
}

function EventConfig({ event, value, onChange }: { event: TriggerEvent; value: unknown; onChange: (v: unknown) => void }) {
    const types = TRIGGER_TYPES[event]
    if (types) return <TypesConfig all={types} value={value} onChange={onChange} />
    if (event === "schedule") return <ScheduleConfig value={value} onChange={onChange} />
    return <DispatchConfig value={value} onChange={onChange} />
}

/** `types:` checkboxes; all checked is written as no config, which matches every type. */
function TypesConfig({ all, value, onChange }: { all: string[]; value: unknown; onChange: (v: unknown) => void }) {
    const { t } = useTranslation()
    const listed = isRecord(value) && Array.isArray(value.types) ? value.types.map(String) : all
    const selected = all.filter(ty => listed.includes(ty))
    const setTypes = (next: string[]) => {
        const rest = isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== "types")) : {}
        if (next.length === all.length) onChange(Object.keys(rest).length ? rest : null)
        else onChange({ ...rest, types: next })
    }
    return (
        <div className="flex flex-col gap-1">
            <span className={labelClass}>types</span>
            <div className="flex gap-x-3 gap-y-1 flex-wrap">
                {all.map(ty => {
                    const checked = selected.includes(ty)
                    // At least one type must stay selected: an empty list means "all".
                    const last = checked && selected.length === 1
                    return (
                        <label key={ty} className={cn("flex items-center gap-1.5 text-sm", last && "opacity-60")}>
                            <input type="checkbox" checked={checked} disabled={last}
                                onChange={e => setTypes(e.target.checked ? all.filter(x => x === ty || selected.includes(x)) : selected.filter(x => x !== ty))} />
                            <span className="font-mono text-xs">{ty}</span>
                        </label>
                    )
                })}
            </div>
            <span className={hintClass}>{t("pages.workflows.visual.typesHint")}</span>
        </div>
    )
}

function ScheduleConfig({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
    const { t } = useTranslation()
    const crons = Array.isArray(value) ? value.map(e => (isRecord(e) ? String(e.cron ?? "") : "")).filter(Boolean) : []
    const text = crons.join("\n")
    const [local, setLocal] = useState(text)
    useEffect(() => setLocal(text), [text])
    const commit = () => {
        const next = local.split("\n").map(l => l.trim()).filter(Boolean)
        if (next.join("\n") === text) return
        onChange(next.length ? next.map(cron => ({ cron })) : [{ cron: DEFAULT_CRON }])
    }
    return (
        <div className="flex flex-col gap-1">
            <span className={labelClass}>cron</span>
            <textarea className={cn(inputClass, "font-mono")} rows={Math.max(2, local.split("\n").length)} value={local}
                spellCheck={false} onChange={e => setLocal(e.target.value)} onBlur={commit} />
            <span className={hintClass}>{t("pages.workflows.visual.cronHint")}</span>
        </div>
    )
}

/** workflow_dispatch inputs as rows of name / description / default / required. */
function DispatchConfig({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
    const { t } = useTranslation()
    const rawInputs = isRecord(value) && isRecord(value.inputs) ? value.inputs : {}
    const inputs: [string, DispatchInput][] = Object.entries(rawInputs).map(([k, v]) => [k, isRecord(v) ? v as DispatchInput : {}])

    const write = (next: [string, DispatchInput][]) => {
        const rest = isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([k]) => k !== "inputs")) : {}
        const cleaned = next.map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== "" && x !== false))])
        if (cleaned.length === 0) onChange(Object.keys(rest).length ? rest : null)
        else onChange({ ...rest, inputs: Object.fromEntries(cleaned) })
    }
    const update = (i: number, patch: Partial<DispatchInput> & { name?: string }) => {
        const { name, ...fields } = patch
        write(inputs.map(([k, v], j) => (j === i ? [name ?? k, { ...v, ...fields }] : [k, v])))
    }
    const add = () => {
        let n = inputs.length + 1
        while (inputs.some(([k]) => k === `input${n}`)) n++
        write([...inputs, [`input${n}`, { description: "" }]])
    }

    return (
        <div className="flex flex-col gap-2">
            <span className={labelClass}>inputs</span>
            {inputs.map(([name, def], i) => (
                <div key={i} className="flex flex-col gap-1.5 p-2 rounded border dark:border-neutral-700 bg-white dark:bg-neutral-900">
                    <div className="flex items-center gap-1.5">
                        <CommitInput className="font-mono flex-1" value={name} placeholder="name"
                            onCommit={v => v && v !== name && !inputs.some(([k]) => k === v) && update(i, { name: v })} />
                        <label className="flex items-center gap-1 text-xs shrink-0">
                            <input type="checkbox" checked={!!def.required} onChange={e => update(i, { required: e.target.checked })} />
                            {t("pages.workflows.visual.required")}
                        </label>
                        <button type="button" className="text-red-500 p-1" aria-label={t("actions.delete")} onClick={() => write(inputs.filter((_, j) => j !== i))}>
                            <X size={14} />
                        </button>
                    </div>
                    <CommitInput value={def.description ?? ""} placeholder="description" onCommit={v => update(i, { description: v })} />
                    <CommitInput className="font-mono" value={def.default === undefined ? "" : String(def.default)} placeholder="default" onCommit={v => update(i, { default: v })} />
                </div>
            ))}
            <button type="button" onClick={add} className="self-start px-2 py-1 flex gap-1 items-center text-xs rounded border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <Plus size={13} />{t("pages.workflows.visual.addInput")}
            </button>
        </div>
    )
}

function CommitInput({ value, onCommit, placeholder, className }: { value: string; onCommit: (v: string) => void; placeholder?: string; className?: string }) {
    const [local, setLocal] = useState(value)
    useEffect(() => setLocal(value), [value])
    const commit = () => { if (local !== value) onCommit(local.trim()) }
    return (
        <input className={cn(inputClass, "py-1 text-xs", className)} value={local} placeholder={placeholder}
            onChange={e => setLocal(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setLocal(value) }} />
    )
}
