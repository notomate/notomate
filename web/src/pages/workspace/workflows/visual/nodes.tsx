import { Handle, Position, type NodeProps } from "@xyflow/react"
import { useTranslation } from "react-i18next"
import { Package, Plus, Terminal, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { MAX_STEPS_SHOWN, type JobNodeType, type TriggerNodeType } from "./graph/toFlow"
import { useEditorStore } from "./store"
import { TRIGGER_ICONS, stepLabel, useIssueText } from "./labels"

const nodeBase = "rounded-lg border bg-white dark:bg-neutral-800 shadow-sm text-sm transition-shadow"
const handleClass = "!w-2.5 !h-2.5 !bg-neutral-400 dark:!bg-neutral-500 !border-white dark:!border-neutral-800"

export function TriggerNode({ data, selected }: NodeProps<TriggerNodeType>) {
    const { t } = useTranslation()
    return (
        <div className={cn(nodeBase, "w-[200px] px-3 py-2.5 border-amber-300 dark:border-amber-700", selected && "ring-2 ring-primary")}>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
                <Zap size={13} />
                {t("pages.workflows.visual.triggerNode")}
            </div>
            {data.triggers.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t("pages.workflows.visual.noTriggers")}</div>
            ) : (
                <ul className="flex flex-col gap-1">
                    {data.triggers.map(tr => {
                        const Icon = TRIGGER_ICONS[tr] ?? Zap
                        return (
                            <li key={tr} className="flex items-center gap-2 font-mono text-xs">
                                <Icon size={13} className="shrink-0 opacity-60" />
                                {tr}
                            </li>
                        )
                    })}
                </ul>
            )}
            <Handle type="source" position={Position.Right} isConnectable={false} className={handleClass} />
        </div>
    )
}

export function JobNode({ data, selected }: NodeProps<JobNodeType>) {
    const { t } = useTranslation()
    const store = useEditorStore()
    const issueText = useIssueText()
    const { job, issues } = data
    const hasError = issues.some(i => i.level === "error")
    const hasWarning = !hasError && issues.length > 0
    const shown = job.steps.slice(0, MAX_STEPS_SHOWN)
    return (
        <div
            className={cn(
                nodeBase,
                "group w-[240px]",
                hasError ? "border-red-400 dark:border-red-600" : hasWarning ? "border-amber-400 dark:border-amber-600" : "dark:border-neutral-700",
                selected && "ring-2 ring-primary",
            )}
            title={issues.map(issueText).join("\n") || undefined}
        >
            <Handle type="target" position={Position.Left} className={handleClass} />
            <div className="px-3 pt-2.5 pb-1.5 border-b dark:border-neutral-700">
                <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <div className="font-mono font-semibold truncate">{job.id}</div>
                        {job.name && job.name !== job.id && <div className="text-xs text-muted-foreground truncate">{job.name}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                        {job.hasMatrix && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">matrix</span>}
                        {job.if && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" title={`if: ${job.if}`}>if</span>}
                    </div>
                </div>
                <div className={cn("text-xs font-mono mt-0.5 truncate", job.runsOn || job.uses ? "text-muted-foreground" : "text-red-500")}>
                    {job.uses ? `↪ ${job.uses}` : job.runsOn ?? t("pages.workflows.visual.missingRunsOn")}
                </div>
            </div>
            {!job.uses && (
                <ol className="px-2 py-1.5 flex flex-col gap-0.5">
                    {shown.map(s => {
                        const Icon = s.uses ? Package : Terminal
                        return (
                            <li key={s.index} className="flex items-center gap-1.5 px-1 text-xs min-w-0">
                                <Icon size={12} className={cn("shrink-0", s.uses ? "text-primary" : "opacity-50")} />
                                <span className="truncate">{stepLabel(s, t("pages.workflows.visual.emptyStep"))}</span>
                            </li>
                        )
                    })}
                    {job.steps.length > MAX_STEPS_SHOWN && (
                        <li className="px-1 text-xs text-muted-foreground">{t("pages.workflows.visual.moreSteps", { count: job.steps.length - MAX_STEPS_SHOWN })}</li>
                    )}
                    {job.steps.length === 0 && <li className="px-1 text-xs text-muted-foreground">{t("pages.workflows.visual.noSteps")}</li>}
                    <li>
                        <button
                            type="button"
                            className="nodrag w-full mt-0.5 flex items-center gap-1 px-1 py-0.5 rounded text-xs text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            onClick={e => {
                                e.stopPropagation()
                                store.getState().select({ kind: "job", id: job.id })
                                store.getState().openPicker({ jobId: job.id })
                            }}
                        >
                            <Plus size={12} />
                            {t("pages.workflows.visual.addAction")}
                        </button>
                    </li>
                </ol>
            )}
            <Handle type="source" position={Position.Right} className={handleClass} />
        </div>
    )
}
