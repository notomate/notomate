import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowDown, ArrowUp, ChevronRight, Copy, Package, Plus, Search, Terminal, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEditor, useEditorStore } from "../store"
import { useIssues } from "../actions/issues"
import * as m from "../model/mutate"
import { JOB_ID_RE, wouldCreateCycle } from "../model/validate"
import type { JobView, StepView } from "../model/types"
import { stepLabel, useIssueText } from "../labels"
import { Section, TextAreaField, TextField, YamlField, hintClass } from "./fields"
import ActionInputs from "./ActionInputs"

const RUNNERS = ["ubuntu-latest", "self-hosted"]

const smallButton = "px-2 py-1 flex gap-1 items-center text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40"
const chipClass = "px-1.5 py-0.5 rounded border dark:border-neutral-700 font-mono text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-700"

export default function JobInspector({ job }: { job: JobView }) {
    const { t } = useTranslation()
    const store = useEditorStore()
    const view = useEditor(s => s.view)
    const issueText = useIssueText()
    const issues = useIssues().filter(i => i.jobId === job.id)
    const { apply } = store.getState()
    const set = (key: string, value: unknown) => apply(doc => m.setJobField(doc, job.id, key, value))
    const others = view.jobs.filter(j => j.id !== job.id)

    const rename = (newId: string) => apply(
        doc => m.renameJob(doc, job.id, newId),
        s => {
            const { [job.id]: pos, ...rest } = s.positions
            return { positions: pos ? { ...rest, [newId]: pos } : rest, selection: { kind: "job", id: newId } }
        },
    )

    const duplicate = () => {
        let newId = ""
        apply(
            doc => { newId = m.duplicateJob(doc, job.id) },
            s => {
                const p = s.positions[job.id]
                return {
                    selection: { kind: "job", id: newId },
                    positions: p ? { ...s.positions, [newId]: { x: p.x + 30, y: p.y + 30 } } : s.positions,
                }
            },
        )
    }

    const toggleNeed = (dep: string, on: boolean) =>
        apply(doc => (on ? m.addNeed(doc, job.id, dep) : m.removeNeed(doc, job.id, dep)))

    return (
        <div>
            <header className="flex items-center justify-between gap-2 px-4 py-3 border-b dark:border-neutral-700">
                <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Job</div>
                    <h2 className="font-semibold font-mono truncate">{job.id}</h2>
                </div>
                <div className="flex gap-1 shrink-0">
                    <button type="button" className={smallButton} onClick={duplicate}>
                        <Copy size={13} />{t("pages.workflows.visual.duplicate")}
                    </button>
                    <button type="button" className={cn(smallButton, "text-red-500")} onClick={() => apply(doc => m.removeJob(doc, job.id), () => ({ selection: null }))}>
                        <Trash2 size={13} />{t("actions.delete")}
                    </button>
                </div>
            </header>

            {issues.length > 0 && (
                <ul className="px-4 py-2 flex flex-col gap-1 border-b dark:border-neutral-700">
                    {issues.map((i, k) => (
                        <li key={k} className={cn("text-xs", i.level === "error" ? "text-red-500" : "text-amber-600 dark:text-amber-400")}>{issueText(i)}</li>
                    ))}
                </ul>
            )}

            <Section>
                <TextField
                    label="Job ID"
                    value={job.id}
                    mono
                    validate={v => !JOB_ID_RE.test(v)
                        ? t("pages.workflows.visual.jobIdInvalid")
                        : v !== job.id && view.jobs.some(j => j.id === v) ? t("pages.workflows.visual.jobIdTaken") : null}
                    onCommit={rename}
                    hint={t("pages.workflows.visual.jobIdHint")}
                />
                <TextField label="name" value={job.name} onCommit={v => set("name", v)} placeholder={job.id} />
                {job.uses ? (
                    <TextField label="uses" value={job.uses} mono onCommit={v => set("uses", v)} />
                ) : (
                    <TextField
                        label="runs-on"
                        value={job.runsOn}
                        mono
                        onCommit={v => set("runs-on", v)}
                        hint={<span className="flex gap-1 flex-wrap">{RUNNERS.map(r => (
                            <button type="button" key={r} className={chipClass} onClick={() => set("runs-on", r)}>{r}</button>
                        ))}</span>}
                    />
                )}
                <TextField label="if" value={job.if} mono placeholder="vars.ENABLED == 'true'" onCommit={v => set("if", v)} />
            </Section>

            <Section title={t("pages.workflows.visual.needs")}>
                {others.length === 0 ? (
                    <p className={hintClass}>{t("pages.workflows.visual.noOtherJobs")}</p>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        {others.map(o => {
                            const checked = job.needs.includes(o.id)
                            const blocked = !checked && wouldCreateCycle(view, o.id, job.id)
                            return (
                                <label key={o.id} className={cn("flex items-center gap-2 text-sm", blocked && "opacity-50")} title={blocked ? t("pages.workflows.visual.cycleBlocked") : undefined}>
                                    <input type="checkbox" checked={checked} disabled={blocked} onChange={e => toggleNeed(o.id, e.target.checked)} />
                                    <span className="font-mono">{o.id}</span>
                                </label>
                            )
                        })}
                    </div>
                )}
                <p className={hintClass}>{t("pages.workflows.visual.needsHint")}</p>
            </Section>

            {!job.uses && <StepsEditor job={job} />}

            <details className="px-4 py-3 border-b dark:border-neutral-700 group">
                <summary className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none">
                    {t("pages.workflows.visual.advanced")}
                </summary>
                <div className="flex flex-col gap-3 mt-3">
                    <TextField
                        label="timeout-minutes"
                        value={job.raw["timeout-minutes"] === undefined ? undefined : String(job.raw["timeout-minutes"])}
                        validate={v => (v === "" || /^\d+$/.test(v) || v.startsWith("${{") ? null : t("pages.workflows.visual.integerRequired"))}
                        onCommit={v => set("timeout-minutes", /^\d+$/.test(v) ? Number(v) : v)}
                    />
                    <YamlField label="strategy" value={job.raw.strategy} onCommit={v => set("strategy", v)} placeholder={"matrix:\n  version: [1, 2]"} />
                    <YamlField label="env" value={job.raw.env} onCommit={v => set("env", v)} placeholder="KEY: value" />
                    <YamlField label="outputs" value={job.raw.outputs} onCommit={v => set("outputs", v)} />
                    <YamlField label="services" value={job.raw.services} onCommit={v => set("services", v)} />
                    <YamlField label="container" value={job.raw.container} onCommit={v => set("container", v)} />
                </div>
            </details>
        </div>
    )
}

function StepsEditor({ job }: { job: JobView }) {
    const { t } = useTranslation()
    const store = useEditorStore()
    const { apply, openPicker } = store.getState()
    const [open, setOpen] = useState<number | null>(null)

    const addShell = () => {
        apply(doc => m.addStep(doc, job.id, { name: "Run script", run: 'echo "Hello"' }))
        setOpen(job.steps.length)
    }
    const move = (from: number, to: number) => {
        apply(doc => m.moveStep(doc, job.id, from, to))
        if (open === from) setOpen(to)
    }

    return (
        <Section title={<>{t("pages.workflows.visual.steps")} <span className="ml-1 font-normal">{job.steps.length}</span></>}>
            <ol className="flex flex-col gap-1">
                {job.steps.map((s, i) => {
                    const Icon = s.uses ? Package : Terminal
                    return (
                        <li key={i} className={cn("rounded-md border dark:border-neutral-700", open === i && "bg-neutral-50 dark:bg-neutral-900/50")}>
                            <div className="flex items-center gap-1 pr-1">
                                <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}
                                    className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 text-left text-sm">
                                    <ChevronRight size={13} className={cn("shrink-0 transition-transform", open === i && "rotate-90")} />
                                    <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                    <Icon size={13} className={cn("shrink-0", s.uses ? "text-primary" : "opacity-50")} />
                                    <span className="truncate">{stepLabel(s, t("pages.workflows.visual.emptyStep"))}</span>
                                </button>
                                <button type="button" className={smallButton} aria-label={t("pages.workflows.visual.moveUp")} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={13} /></button>
                                <button type="button" className={smallButton} aria-label={t("pages.workflows.visual.moveDown")} disabled={i === job.steps.length - 1} onClick={() => move(i, i + 1)}><ArrowDown size={13} /></button>
                                <button type="button" className={cn(smallButton, "text-red-500")} aria-label={t("pages.workflows.visual.removeStep")}
                                    onClick={() => { apply(doc => m.removeStep(doc, job.id, i)); setOpen(null) }}>
                                    <X size={13} />
                                </button>
                            </div>
                            {open === i && <StepForm jobId={job.id} step={s} />}
                        </li>
                    )
                })}
            </ol>
            <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => openPicker({ jobId: job.id })}
                    className="px-3 py-1.5 flex gap-1.5 items-center text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary-hover">
                    <Plus size={14} />{t("pages.workflows.visual.addFromMarketplace")}
                </button>
                <button type="button" onClick={addShell}
                    className="px-3 py-1.5 flex gap-1.5 items-center text-sm rounded-md border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                    <Terminal size={14} />{t("pages.workflows.visual.addShellStep")}
                </button>
            </div>
        </Section>
    )
}

function StepForm({ jobId, step }: { jobId: string; step: StepView }) {
    const { t } = useTranslation()
    const store = useEditorStore()
    const { apply, openPicker } = store.getState()
    const patch = (p: Record<string, unknown>) => apply(doc => m.updateStep(doc, jobId, step.index, p))
    const kind = step.uses !== undefined ? "uses" : "run"
    const segment = (active: boolean) => cn("flex-1 px-2 py-1 text-xs rounded", active ? "bg-white dark:bg-neutral-700 shadow-sm font-medium" : "text-muted-foreground")

    return (
        <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
            <div className="flex p-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800" role="group">
                <button type="button" aria-pressed={kind === "uses"} className={segment(kind === "uses")}
                    onClick={() => kind !== "uses" && openPicker({ jobId, stepIndex: step.index })}>
                    {t("pages.workflows.visual.stepUses")}
                </button>
                <button type="button" aria-pressed={kind === "run"} className={segment(kind === "run")}
                    onClick={() => kind !== "run" && patch({ uses: undefined, with: undefined, run: 'echo "Hello"' })}>
                    {t("pages.workflows.visual.stepRun")}
                </button>
            </div>
            <TextField label="name" value={step.name} onCommit={v => patch({ name: v })} />
            {kind === "uses" ? (
                <>
                    <div className="flex items-end gap-1.5">
                        <div className="flex-1 min-w-0">
                            <TextField label="uses" value={step.uses} mono placeholder="owner/repo@v1" onCommit={v => patch({ uses: v })} />
                        </div>
                        <button type="button" onClick={() => openPicker({ jobId, stepIndex: step.index })} title={t("pages.workflows.visual.browseActions")}
                            className="mb-px px-2 py-1.5 flex items-center gap-1 text-xs rounded-md border dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                            <Search size={13} />{t("pages.workflows.visual.browse")}
                        </button>
                    </div>
                    {step.uses && <ActionInputs uses={step.uses} values={step.with} path={m.stepWithPath(jobId, step.index)} />}
                </>
            ) : (
                <>
                    <TextAreaField label="run" value={step.run} onCommit={v => patch({ run: v })} rows={3} />
                    <TextField label="shell" value={step.shell} mono placeholder="bash" onCommit={v => patch({ shell: v })} />
                    <TextField label="working-directory" value={step.workingDirectory} mono onCommit={v => patch({ "working-directory": v })} />
                </>
            )}
            <TextField label="id" value={step.id} mono onCommit={v => patch({ id: v })} />
            <TextField label="if" value={step.if} mono onCommit={v => patch({ if: v })} />
            <YamlField label="env" value={step.env} onCommit={v => patch({ env: v })} />
        </div>
    )
}
