import { isRecord } from "./parse"
import type { Issue, WorkflowView } from "./types"

export const JOB_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/

/** Triggers the notomate server accepts (api/internal/workflow/spec.go). */
export const TRIGGER_EVENTS = ["note", "comment", "channel", "schedule", "workflow_dispatch"] as const
export type TriggerEvent = typeof TRIGGER_EVENTS[number]

/** Event types per trigger; a trigger without `types` matches all of them. */
export const TRIGGER_TYPES: Partial<Record<TriggerEvent, string[]>> = {
    note: ["created", "updated", "deleted"],
    comment: ["created", "updated", "deleted"],
    channel: ["room_created", "message", "client_connected", "client_disconnected"],
}

/** True when adding from→to (to needs from) would create a cycle. */
export function wouldCreateCycle(view: WorkflowView, from: string, to: string): boolean {
    if (from === to) return true
    const needs = new Map(view.jobs.map(j => [j.id, j.needs]))
    // `to` would depend on `from`; that's a cycle if `from` already reaches `to`.
    const stack = [from]
    const seen = new Set<string>()
    while (stack.length) {
        const cur = stack.pop()!
        if (cur === to) return true
        if (seen.has(cur)) continue
        seen.add(cur)
        stack.push(...(needs.get(cur) ?? []))
    }
    return false
}

export function findCycleJobs(view: WorkflowView): Set<string> {
    const needs = new Map(view.jobs.map(j => [j.id, j.needs]))
    const state = new Map<string, 1 | 2>()
    const inCycle = new Set<string>()
    const path: string[] = []
    const visit = (id: string) => {
        if (state.get(id) === 2) return
        if (state.get(id) === 1) {
            inCycle.add(id)
            for (let i = path.length - 1; i >= 0 && path[i] !== id; i--) inCycle.add(path[i])
            return
        }
        state.set(id, 1)
        path.push(id)
        for (const n of needs.get(id) ?? []) if (needs.has(n)) visit(n)
        path.pop()
        state.set(id, 2)
    }
    for (const j of view.jobs) visit(j.id)
    return inCycle
}

export function validate(view: WorkflowView): Issue[] {
    const issues: Issue[] = []
    if (view.triggers.length === 0) issues.push({ level: "error", key: "noTrigger" })
    for (const t of view.triggers) {
        if (!(TRIGGER_EVENTS as readonly string[]).includes(t)) {
            issues.push({ level: "error", key: "unsupportedTrigger", params: { trigger: t } })
            continue
        }
        const types = TRIGGER_TYPES[t as TriggerEvent]
        const config = view.on[t]
        if (types && isRecord(config) && Array.isArray(config.types)) {
            for (const ty of config.types) {
                if (!types.includes(String(ty))) issues.push({ level: "error", key: "invalidEventType", params: { trigger: t, type: String(ty) } })
            }
        }
        if (t === "schedule" && (!Array.isArray(config) || config.length === 0)) {
            issues.push({ level: "error", key: "scheduleNeedsCron" })
        }
    }
    if (view.jobs.length === 0) issues.push({ level: "error", key: "noJobs" })
    const ids = new Set(view.jobs.map(j => j.id))
    for (const job of view.jobs) {
        if (!JOB_ID_RE.test(job.id)) issues.push({ level: "error", jobId: job.id, key: "invalidJobId", params: { job: job.id } })
        for (const n of job.needs) {
            if (!ids.has(n)) issues.push({ level: "error", jobId: job.id, key: "unknownNeed", params: { job: job.id, need: n } })
        }
        if (job.uses) continue // reusable workflows have no runs-on / steps
        if (!job.runsOn) issues.push({ level: "error", jobId: job.id, key: "missingRunsOn", params: { job: job.id } })
        if (job.steps.length === 0) issues.push({ level: "warning", jobId: job.id, key: "noSteps", params: { job: job.id } })
        job.steps.forEach((s, i) => {
            if (!s.uses && !s.run) issues.push({ level: "error", jobId: job.id, key: "stepNeedsUsesOrRun", params: { job: job.id, step: i + 1 } })
            if (s.uses && s.run) issues.push({ level: "error", jobId: job.id, key: "stepBothUsesAndRun", params: { job: job.id, step: i + 1 } })
        })
    }
    for (const id of findCycleJobs(view)) issues.push({ level: "error", jobId: id, key: "cycle", params: { job: id } })
    return issues
}
