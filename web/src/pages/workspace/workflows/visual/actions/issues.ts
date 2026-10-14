import { useMemo } from "react"
import type { Issue, WorkflowView } from "../model/types"
import { useEditor } from "../store"
import { checkInputs, useActionCatalog, type ActionCatalog } from "./catalog"

/** Input warnings from action metadata; GitHub only warns or fails at run time here. */
export function metaIssues(view: WorkflowView, lookup: ActionCatalog["lookup"]): Issue[] {
    const issues: Issue[] = []
    for (const job of view.jobs) {
        job.steps.forEach((s, i) => {
            if (!s.uses) return
            const entry = lookup(s.uses)
            if (!entry) return
            const r = checkInputs(entry, s.with)
            const params = { job: job.id, step: i + 1, uses: s.uses }
            for (const n of r.missing) issues.push({ level: "warning", jobId: job.id, key: "missingInput", params: { ...params, input: n } })
            for (const n of r.unknown) issues.push({ level: "warning", jobId: job.id, key: "unknownInput", params: { ...params, input: n } })
            for (const n of r.deprecated) issues.push({ level: "warning", jobId: job.id, key: "deprecatedInput", params: { ...params, input: n } })
        })
    }
    return issues
}

/** Structural issues plus action input checks. */
export function useIssues(): Issue[] {
    const view = useEditor(s => s.view)
    const base = useEditor(s => s.issues)
    const { lookup } = useActionCatalog()
    return useMemo(() => [...base, ...metaIssues(view, lookup)], [base, view, lookup])
}
