import { useTranslation } from "react-i18next"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkflowValidationError } from "@/api/workflow"
import { useEditor, useEditorStore } from "../store"
import { useIssues } from "../actions/issues"
import { useIssueText } from "../labels"
import { Section } from "./fields"
import JobInspector from "./JobInspector"
import TriggerInspector from "./TriggerInspector"

interface Props {
    /** Errors the server returned on the last save. */
    serverErrors: WorkflowValidationError[]
    onShowLine: (line: number) => void
}

export default function Inspector({ serverErrors, onShowLine }: Props) {
    const { t } = useTranslation()
    const store = useEditorStore()
    const selection = useEditor(s => s.selection)
    const view = useEditor(s => s.view)
    const issues = useIssues()
    const issueText = useIssueText()
    const { select } = store.getState()

    if (selection?.kind === "trigger") return <TriggerInspector />
    const job = selection?.kind === "job" ? view.jobs.find(j => j.id === selection.id) : undefined
    if (job) return <JobInspector key={job.id} job={job} />

    const errors = issues.filter(i => i.level === "error").length
    const stats = [
        { value: view.triggers.length, label: t("pages.workflows.visual.statTriggers") },
        { value: view.jobs.length, label: "jobs" },
        { value: view.jobs.reduce((n, j) => n + j.steps.length, 0), label: "steps" },
        { value: errors, label: t("pages.workflows.visual.statErrors"), error: errors > 0 },
    ]

    return (
        <div>
            <header className="px-4 py-3 border-b dark:border-neutral-700">
                <div className="text-xs text-muted-foreground">{t("pages.workflows.visual.workflow")}</div>
                <h2 className="font-semibold truncate">{view.name ?? t("pages.workflows.visual.unnamed")}</h2>
            </header>
            <div className="grid grid-cols-4 gap-2 px-4 py-3 border-b dark:border-neutral-700">
                {stats.map(s => (
                    <div key={s.label} className={cn("flex flex-col items-center rounded-md py-1.5 bg-neutral-50 dark:bg-neutral-900", s.error && "text-red-500")}>
                        <strong className="text-lg leading-tight">{s.value}</strong>
                        <span className="text-[11px] text-muted-foreground">{s.label}</span>
                    </div>
                ))}
            </div>

            {serverErrors.length > 0 && (
                <Section title={t("pages.workflows.visual.serverErrors")}>
                    <ul className="flex flex-col gap-1">
                        {serverErrors.map((e, k) => (
                            <li key={k} className="text-xs text-red-500">
                                {e.line > 0
                                    ? <button type="button" className="text-left hover:underline" onClick={() => onShowLine(e.line)}>L{e.line}: {e.message}</button>
                                    : e.message}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Section title={t("pages.workflows.visual.checks")}>
                {issues.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400"><CheckCircle2 size={15} />{t("pages.workflows.visual.noIssues")}</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {issues.map((i, k) => (
                            <li key={k}>
                                <button type="button"
                                    className={cn("text-left text-xs hover:underline", i.level === "error" ? "text-red-500" : "text-amber-600 dark:text-amber-400")}
                                    onClick={() => select(i.jobId ? { kind: "job", id: i.jobId } : { kind: "trigger" })}>
                                    {issueText(i)}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title={t("pages.workflows.visual.help")}>
                <ul className="list-disc pl-4 flex flex-col gap-1 text-xs text-muted-foreground">
                    {(["helpSelect", "helpConnect", "helpDropNew", "helpDelete", "helpAddAction", "helpUndo"] as const).map(k => (
                        <li key={k}>{t(`pages.workflows.visual.${k}`)}</li>
                    ))}
                </ul>
            </Section>
        </div>
    )
}
