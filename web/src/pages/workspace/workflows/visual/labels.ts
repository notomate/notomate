import { useTranslation } from "react-i18next"
import { Clock, FileText, MessageSquare, MessagesSquare, Play, type LucideIcon } from "lucide-react"
import type { Issue, StepView } from "./model/types"

export function stepLabel(s: StepView, empty: string): string {
    if (s.name) return s.name
    if (s.uses) return s.uses
    if (s.run) return s.run.split("\n")[0]
    return empty
}

export const TRIGGER_ICONS: Record<string, LucideIcon> = {
    note: FileText,
    comment: MessageSquare,
    channel: MessagesSquare,
    schedule: Clock,
    workflow_dispatch: Play,
}

export function useIssueText() {
    const { t } = useTranslation()
    return (i: Issue) => t(`pages.workflows.visual.issues.${i.key}`, i.params)
}
